# Hibira tool for Open WebUI

An [Open WebUI](https://openwebui.com) tool that lets a model:

- **Hand a Live Chat conversation to a person.** It lists the chats no one
  has picked up, reads one, leaves an internal note with its summary (the
  visitor doesn't see it) and assigns the chat to an agent or moves it to a
  team.
- **Send a push notification** through Hibira Push to interests or signed-in
  user IDs.
- **Ask a person to approve** before it acts. The question gets a Hibira
  answer page; the link shows in the chat and can go out as a push
  notification. The tool waits for the answer (5 minutes by default) and
  tells the model approved, rejected or expired.

One Python file, standard library only.

| Tool | Uses |
| --- | --- |
| `list_waiting_chats`, `read_chat`, `hand_off_chat` | [Live Chat REST API](https://chat.hibira.io/docs) with a workspace API key (Team plan and up) |
| `send_push` | The Hibira MCP server's `send_push` with a personal access token |
| `ask_for_approval`, `check_approval` | The Hibira MCP server's `request_approval` / `get_approval` |

## Install

1. In Open WebUI, open **Workspace → Tools → +**, paste
   [`hibira.py`](hibira.py) and save. (Or import it from the Open WebUI
   community site.)
2. Press the gear on the tool and fill in the valves:

   | Valve | Where to get it |
   | --- | --- |
   | `hibira_token` | [hibira.io](https://hibira.io/portal) → **API tokens** → new token with read and write access |
   | `app_id` | The app whose push and approvals to use (`app_...`). Turn on push for the app for `send_push`. |
   | `livechat_api_key` | Live Chat → **Settings → API keys** → a write key |
   | `approval_wait_seconds` | How long `ask_for_approval` waits (default 300) |

   Leave out the ones you don't need: the Live Chat tools only need
   `livechat_api_key`, push and approvals only need `hibira_token` and
   `app_id`.
3. Turn the tool on for a model (**Workspace → Models → Tools**) or per
   chat with the **+** button. Native function calling works best.

Try: "Any chats waiting? Hand the refund one to Bo with a summary." or
"Ask me on my phone before you send this email" (with `notify_users` set to
your push user ID).

## Tests

```sh
pip install pydantic
python -m unittest
```

The tests run the tool against a fake Hibira on localhost.

## 中文摘要

給 Open WebUI 用的 Hibira 工具（單一 Python 檔，只用標準函式庫）。模型可以：列出還沒有人接的 Live Chat 對話、讀取對話、留下內部備註（訪客看不到）並轉給指定客服或團隊；透過 Hibira Push 發推播；在動手前請真人審批（產生 Hibira 回覆頁面連結，可同時推播，工具會等待結果）。在 Workspace → Tools 貼上 `hibira.py`，再到設定填入 Hibira 個人存取權杖、App ID 與 Live Chat API 金鑰即可。
