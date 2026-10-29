extends Control
# Reaction rooms: a room list, seats for four, a host, ready flags, kick, room
# chat with typing indicators, and a five-round reaction game. It speaks the
# same events as ../nextjs-lobby, so Godot and browser players can share a
# room when both use the same Hibira app and backend.
#
# The UI is built in code so the whole example reads top to bottom in one
# file. Set the exported values in the Inspector, or the HIBIRA_* environment
# variables (see README.md).

const CAPACITY := 4
const ROOM_PREFIX := "presence-room-"
const TAP_EVENT := "client-game-tap"
const ROUNDS := 5
## Seconds a round stays open after "GO!".
const ROUND_WINDOW := 2.0
const CODE_LETTERS := "ABCDEFGHJKLMNPQRSTUVWXYZ"

## The app key from the Hibira portal.
@export var app_key := ""
@export var hibira_host := "ws.hibira.io"
@export var hibira_port := 443
@export var hibira_tls := true
## The backend that signs room subscriptions and lists rooms. ../nextjs-lobby
## serves both on http://localhost:3000.
@export var backend_url := "http://localhost:3000"
@export var auth_path := "/api/hibira/auth"
@export var rooms_path := "/api/rooms"

var hibira: HibiraClient
var room: HibiraRoom
var player := {"id": "", "name": ""}

# Game state, as in nextjs-lobby's RoomView.
var stage := "lobby" # lobby, wait, go, result, over
var stage_round := 0
var go_at := 0.0
var result_winner := ""
var taps := {} # user id -> ms (-1: false start)
var scores := {}
var game_gen := 0

var _rooms_http: HTTPRequest
var _ui := {}


func _ready() -> void:
	_read_env()
	_load_player()
	hibira = HibiraClient.new()
	hibira.app_key = app_key
	hibira.host = hibira_host
	hibira.port = hibira_port
	hibira.use_tls = hibira_tls
	hibira.auth_endpoint = backend_url + auth_path
	add_child(hibira)
	hibira.state_changed.connect(func(_s): _render_status())
	hibira.error.connect(func(code, message): push_warning("Hibira error %d: %s" % [code, message]))
	_rooms_http = HTTPRequest.new()
	add_child(_rooms_http)
	_rooms_http.request_completed.connect(_on_rooms)
	_build_ui()
	if app_key.is_empty():
		_ui.status.text = "Set app_key on the Main node (or HIBIRA_APP_KEY), see README.md."
		return
	hibira.connect_to_server()
	var timer := Timer.new()
	timer.wait_time = 4.0
	timer.autostart = true
	timer.timeout.connect(_load_rooms)
	add_child(timer)
	_load_rooms()


func _read_env() -> void:
	app_key = OS.get_environment("HIBIRA_APP_KEY") if OS.has_environment("HIBIRA_APP_KEY") else app_key
	hibira_host = OS.get_environment("HIBIRA_HOST") if OS.has_environment("HIBIRA_HOST") else hibira_host
	if OS.has_environment("HIBIRA_PORT"):
		hibira_port = int(OS.get_environment("HIBIRA_PORT"))
	if OS.has_environment("HIBIRA_TLS"):
		hibira_tls = OS.get_environment("HIBIRA_TLS") != "false"
	backend_url = OS.get_environment("HIBIRA_BACKEND") if OS.has_environment("HIBIRA_BACKEND") else backend_url


func _load_player() -> void:
	var cfg := ConfigFile.new()
	cfg.load("user://player.cfg")
	player.id = cfg.get_value("player", "id", "")
	player.name = cfg.get_value("player", "name", "")
	if player.id == "":
		player.id = "godot-" + Crypto.new().generate_random_bytes(6).hex_encode()
		player.name = "Player %d" % (randi() % 900 + 100)
		_save_player()


func _save_player() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("player", "id", player.id)
	cfg.set_value("player", "name", player.name)
	cfg.save("user://player.cfg")


# ---- rooms -------------------------------------------------------------------

func _load_rooms() -> void:
	if room != null or _rooms_http.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
		return
	_rooms_http.request(backend_url + rooms_path)


func _on_rooms(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	var list: Variant = JSON.parse_string(body.get_string_from_utf8()) if result == HTTPRequest.RESULT_SUCCESS and code == 200 else null
	var items: ItemList = _ui.rooms
	items.clear()
	if list is Array:
		for r in list:
			if r is Dictionary and r.get("id") is String:
				var idx := items.add_item("%s   %d/%d" % [r.id, int(r.get("members", 0)), CAPACITY])
				items.set_item_metadata(idx, r.id)
	_ui.no_rooms.visible = items.item_count == 0


func _enter(code: String) -> void:
	code = code.strip_edges().to_upper()
	if not _valid_code(code):
		_ui.notice.text = "A room code is four letters."
		return
	player.name = _ui.name_edit.text.strip_edges().left(20)
	if player.name.is_empty():
		player.name = "Player"
	_save_player()
	# The auth request carries the player's id and name (this demo's backend
	# trusts them; a real game takes them from its own session).
	hibira.auth_params = {"user_id": player.id, "name": player.name}
	_ui.notice.text = ""
	_reset_game()
	room = HibiraRoom.join(hibira, ROOM_PREFIX + code, {"capacity": CAPACITY})
	for s in [room.joined, room.members_changed, room.host_changed, room.settings_changed, room.typing_changed]:
		s.connect(func(_a = null, _b = null, _c = null): _render_room())
	room.message_received.connect(func(_m): _render_chat())
	room.full.connect(func(_c): _leave("Room %s is full." % code))
	room.kicked.connect(func(_by, _r): _leave("The host removed you from the room."))
	room.join_failed.connect(func(status, _m): _leave("Room %s is full." % code if status == 403 else "Could not join the room."))
	room.started.connect(func(data, _by): _play(data))
	room.channel.bind(TAP_EVENT, func(data, user_id):
		if data is Dictionary and user_id != "":
			_record(user_id, int(data.get("round", -1)), int(data.get("ms", -1))))
	_ui.room_title.text = "Room %s" % code
	_ui.lobby.visible = false
	_ui.room.visible = true
	_render_room()
	_render_chat()


func _leave(why := "") -> void:
	if room != null:
		room.channel.unbind(TAP_EVENT)
		room.leave()
		room = null
	_reset_game()
	_ui.room.visible = false
	_ui.lobby.visible = true
	_ui.notice.text = why
	_load_rooms()


static func _valid_code(code: String) -> bool:
	return RegEx.create_from_string("^[A-Z]{4}$").search(code) != null


static func _new_code() -> String:
	var s := ""
	for i in 4:
		s += CODE_LETTERS[randi() % CODE_LETTERS.length()]
	return s


# ---- the game ----------------------------------------------------------------

func _reset_game() -> void:
	game_gen += 1
	stage = "lobby"
	taps = {}
	scores = {}


func _new_game() -> Dictionary:
	var delays := []
	for i in ROUNDS:
		delays.append(1500 + randi() % 2500)
	return {"delays": delays}


# Every player runs the same rounds from the start event: wait, "GO!", a
# window for taps, then the fastest valid tap scores.
func _play(game: Variant) -> void:
	if not (game is Dictionary and game.get("delays") is Array):
		return
	game_gen += 1
	var gen := game_gen
	scores = {}
	for r in game.delays.size():
		taps = {}
		_set_stage("wait", r)
		await get_tree().create_timer(float(game.delays[r]) / 1000.0).timeout
		if gen != game_gen:
			return
		go_at = Time.get_ticks_msec()
		_set_stage("go", r)
		await get_tree().create_timer(ROUND_WINDOW).timeout
		if gen != game_gen:
			return
		result_winner = _round_winner()
		if result_winner != "":
			scores[result_winner] = scores.get(result_winner, 0) + 1
		_set_stage("result", r)
		await get_tree().create_timer(1.5).timeout
		if gen != game_gen:
			return
	_set_stage("over", 0)


func _set_stage(s: String, r: int) -> void:
	stage = s
	stage_round = r
	_render_room()


func _round_winner() -> String:
	var best := ""
	var best_ms := INF
	for id in taps:
		if taps[id] >= 0 and taps[id] < best_ms:
			best = id
			best_ms = taps[id]
	return best


func _record(user_id: String, r: int, ms: int) -> void:
	if (stage != "go" and stage != "wait") or r != stage_round or taps.has(user_id):
		return
	taps[user_id] = ms
	_render_room()


func _tap() -> void:
	if room == null or room.my_id().is_empty() or (stage != "wait" and stage != "go"):
		return
	if taps.has(room.my_id()):
		return
	var ms := int(Time.get_ticks_msec() - go_at) if stage == "go" else -1
	var mine := {"round": stage_round, "ms": ms}
	# Client events are not echoed to the sender, so record our own tap here.
	room.channel.trigger(TAP_EVENT, mine)
	_record(room.my_id(), stage_round, ms)


# ---- UI ----------------------------------------------------------------------

func _player_name(id: String) -> String:
	if room == null or id.is_empty():
		return ""
	var info: Variant = room.channel.members.get(id)
	return str(info.get("name", "Player")) if info is Dictionary else "Someone"


func _render_status() -> void:
	var labels := {
		HibiraClient.State.DISCONNECTED: "Offline",
		HibiraClient.State.CONNECTING: "Connecting…",
		HibiraClient.State.CONNECTED: "Connected",
		HibiraClient.State.RECONNECTING: "Reconnecting…",
	}
	_ui.status.text = labels[hibira.state]


func _render_room() -> void:
	if room == null:
		return
	var list: VBoxContainer = _ui.players
	for child in list.get_children():
		child.queue_free()
	var players := room.players()
	_ui.players_title.text = "Players %d/%d" % [players.size(), CAPACITY] if room.is_joined else "Joining…"
	for p in players:
		var row := HBoxContainer.new()
		var label := Label.new()
		var tags := ""
		if p.host:
			tags += "  [host]"
		if p.me:
			tags += "  [you]"
		label.text = str(p.info.get("name", "Player") if p.info is Dictionary else "Player") + tags
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(label)
		var score := Label.new()
		score.text = str(scores.get(p.id, 0))
		row.add_child(score)
		var ready := Label.new()
		ready.text = "  Ready" if p.ready else "  Not ready"
		ready.modulate = Color(0.55, 0.93, 0.6) if p.ready else Color(1, 1, 1, 0.5)
		row.add_child(ready)
		if room.is_host() and not p.me:
			var kick := Button.new()
			kick.text = "Remove"
			kick.flat = true
			kick.tooltip_text = "Ask this player to leave"
			kick.pressed.connect(room.kick.bind(p.id))
			row.add_child(kick)
		list.add_child(row)

	var playing := stage != "lobby" and stage != "over"
	var me: Variant = room.me()
	var ready_btn: Button = _ui.ready_btn
	ready_btn.disabled = not room.is_joined or playing
	ready_btn.text = "Not ready" if me != null and me.ready else "I'm ready"
	var start_btn: Button = _ui.start_btn
	start_btn.visible = room.is_host()
	start_btn.disabled = not (players.size() >= 2 and room.all_ready() and not playing)
	start_btn.text = "Play again" if stage == "over" else "Start game"
	_ui.waiting.visible = room.is_joined and not room.is_host()
	_ui.waiting.text = "Waiting for %s to start" % _player_name(room.host().id if room.host() != null else "")

	var pad: Button = _ui.pad
	pad.disabled = not playing
	match stage:
		"lobby": pad.text = "Get ready"
		"wait": pad.text = "Wait for it…"
		"go": pad.text = ("%d ms" % taps[room.my_id()]) if taps.has(room.my_id()) and taps[room.my_id()] >= 0 else "GO!"
		"result": pad.text = ("%s wins round %d" % [_player_name(result_winner), stage_round + 1]) if result_winner != "" else "Nobody this round"
		"over": pad.text = "Game over: %s wins" % (_player_name(_leader()) if _leader() != "" else "nobody")
	_ui.too_early.visible = taps.get(room.my_id(), 0) == -1
	var typing := room.typing().map(_player_name)
	_ui.typing.text = ("%s typing…" % ", ".join(typing)) if not typing.is_empty() else ""


func _leader() -> String:
	var best := ""
	for id in scores:
		if best == "" or scores[id] > scores[best]:
			best = id
	return best


func _render_chat() -> void:
	if room == null:
		return
	var chat: RichTextLabel = _ui.chat_log
	chat.clear()
	for m in room.messages:
		var who := str(m.info.get("name", "Player")) if m.info is Dictionary else "Player"
		chat.push_bold()
		chat.add_text(who)
		chat.pop()
		chat.add_text(" " + m.text + "\n")


func _send_chat() -> void:
	var edit: LineEdit = _ui.chat_edit
	var text := edit.text.strip_edges()
	if text.is_empty() or room == null or not room.is_joined:
		return
	room.send(text)
	edit.clear()
	_render_chat()


func _build_ui() -> void:
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 16)
	add_child(margin)
	var stack := VBoxContainer.new()
	margin.add_child(stack)

	var top := HBoxContainer.new()
	var title := Label.new()
	title.text = "Reaction rooms"
	title.add_theme_font_size_override("font_size", 22)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(title)
	_ui.status = Label.new()
	_ui.status.modulate = Color(1, 1, 1, 0.6)
	top.add_child(_ui.status)
	stack.add_child(top)
	_ui.notice = Label.new()
	_ui.notice.modulate = Color(1, 0.8, 0.4)
	stack.add_child(_ui.notice)

	# Lobby screen
	var lobby := VBoxContainer.new()
	lobby.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_ui.lobby = lobby
	var name_row := HBoxContainer.new()
	var name_label := Label.new()
	name_label.text = "Your name"
	name_row.add_child(name_label)
	_ui.name_edit = LineEdit.new()
	_ui.name_edit.text = player.name
	_ui.name_edit.max_length = 20
	_ui.name_edit.custom_minimum_size.x = 220
	name_row.add_child(_ui.name_edit)
	var create := Button.new()
	create.text = "Create room"
	create.pressed.connect(func(): _enter(_new_code()))
	name_row.add_child(create)
	var code_edit := LineEdit.new()
	code_edit.placeholder_text = "CODE"
	code_edit.max_length = 4
	code_edit.custom_minimum_size.x = 90
	code_edit.text_submitted.connect(func(t): _enter(t))
	name_row.add_child(code_edit)
	var join := Button.new()
	join.text = "Join"
	join.pressed.connect(func(): _enter(code_edit.text))
	name_row.add_child(join)
	lobby.add_child(name_row)
	var open_label := Label.new()
	open_label.text = "Open rooms"
	lobby.add_child(open_label)
	_ui.rooms = ItemList.new()
	_ui.rooms.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_ui.rooms.item_activated.connect(func(i): _enter(_ui.rooms.get_item_metadata(i)))
	lobby.add_child(_ui.rooms)
	_ui.no_rooms = Label.new()
	_ui.no_rooms.text = "No open rooms yet. Create one and share its code."
	_ui.no_rooms.modulate = Color(1, 1, 1, 0.6)
	lobby.add_child(_ui.no_rooms)
	stack.add_child(lobby)

	# Room screen
	var room_box := VBoxContainer.new()
	room_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	room_box.visible = false
	_ui.room = room_box
	var header := HBoxContainer.new()
	_ui.room_title = Label.new()
	_ui.room_title.add_theme_font_size_override("font_size", 20)
	_ui.room_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(_ui.room_title)
	var leave := Button.new()
	leave.text = "Leave"
	leave.pressed.connect(func(): _leave())
	header.add_child(leave)
	room_box.add_child(header)

	var cols := HBoxContainer.new()
	cols.size_flags_vertical = Control.SIZE_EXPAND_FILL
	cols.add_theme_constant_override("separation", 16)
	room_box.add_child(cols)

	var left := VBoxContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cols.add_child(left)
	_ui.players_title = Label.new()
	left.add_child(_ui.players_title)
	_ui.players = VBoxContainer.new()
	left.add_child(_ui.players)
	var actions := HBoxContainer.new()
	_ui.ready_btn = Button.new()
	_ui.ready_btn.pressed.connect(func():
		var me: Variant = room.me()
		room.set_ready(not (me != null and me.ready)))
	actions.add_child(_ui.ready_btn)
	_ui.start_btn = Button.new()
	_ui.start_btn.pressed.connect(func(): room.start(_new_game()))
	actions.add_child(_ui.start_btn)
	_ui.waiting = Label.new()
	_ui.waiting.modulate = Color(1, 1, 1, 0.6)
	actions.add_child(_ui.waiting)
	left.add_child(actions)
	_ui.pad = Button.new()
	_ui.pad.custom_minimum_size = Vector2(0, 200)
	_ui.pad.add_theme_font_size_override("font_size", 28)
	_ui.pad.button_down.connect(_tap)
	left.add_child(_ui.pad)
	_ui.too_early = Label.new()
	_ui.too_early.text = "Too early! Wait for GO."
	_ui.too_early.modulate = Color(1, 0.8, 0.4)
	left.add_child(_ui.too_early)

	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cols.add_child(right)
	var chat_title := Label.new()
	chat_title.text = "Chat"
	right.add_child(chat_title)
	_ui.chat_log = RichTextLabel.new()
	_ui.chat_log.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_ui.chat_log.scroll_following = true
	right.add_child(_ui.chat_log)
	_ui.typing = Label.new()
	_ui.typing.modulate = Color(1, 1, 1, 0.6)
	right.add_child(_ui.typing)
	var chat_row := HBoxContainer.new()
	_ui.chat_edit = LineEdit.new()
	_ui.chat_edit.placeholder_text = "Say something"
	_ui.chat_edit.max_length = 200
	_ui.chat_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_ui.chat_edit.text_changed.connect(func(_t):
		if room != null and room.is_joined:
			room.send_typing())
	_ui.chat_edit.text_submitted.connect(func(_t): _send_chat())
	chat_row.add_child(_ui.chat_edit)
	var send := Button.new()
	send.text = "Send"
	send.pressed.connect(_send_chat)
	chat_row.add_child(send)
	right.add_child(chat_row)
	stack.add_child(room_box)
	_render_status()
