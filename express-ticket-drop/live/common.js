// The live demo at demos.hibira.io/examples/express-ticket-drop/: the
// strings in seven languages, the language menu and the demo backend's
// address (the Worker in hibira-io/examples-infra, demo-api/src/ticket-drop.js,
// does what server.js does here, with the demo app's secret). The pages
// workflow replaces DEMO_API with its NEXT_PUBLIC_DEMO_API.
export const API = 'https://demo-api.hibira.io';

export const STRINGS = {
  en: {
    name: 'English',
    title: 'Ticket drop with a waiting room',
    intro: '500 seats, and everyone presses at once. Press the button and you queue in a real Hibira waiting room with everyone who pressed in the same few seconds, then come back here with a signed pass.',
    event: 'Hibira Live · demo drop',
    eventMeta: '500 seats · a new drop opens every few seconds',
    get: 'Get a ticket',
    going: 'Taking you to the line…',
    inLine: 'in line now',
    taken: 'queue numbers handed out',
    closed: 'This drop is closed right now. Try again in a minute.',
    error: 'The demo cannot reach its server right now. Try again in a moment.',
    howTitle: 'What happens',
    how1: 'You go to the hosted waiting page and take a queue number. Everyone who pressed before the drop opens gets a place in it.',
    how2: 'The line moves at the room’s rate, and your place updates live over a WebSocket.',
    how3: 'At your turn the page sends you back here with a pass signed with the app’s secret, and the server checks it before the checkout.',
    testTitle: 'The same rush in a load test',
    testText: 'The example floods a shop with 3,000 buyers in three seconds, once without the waiting room and once with it.',
    colNo: 'No waiting room',
    colWith: 'With the waiting room',
    rowSold: 'Seats sold',
    rowOver: 'Oversold',
    rowFailed: 'Failed checkouts',
    source: 'Source code',
    product: 'About Hibira Waiting Room',
    all: 'All demos',
    coTitle: 'You’re in',
    coLead: 'Your pass checked out. Here is your seat.',
    section: 'Section',
    row: 'Row',
    seat: 'Seat',
    number: 'Queue number',
    verifiedTitle: 'What the server saw',
    verifiedText: 'verifyPass() from @hibira-io/waiting-room checked the pass’s signature, room and expiry with the app’s secret.',
    again: 'Queue again',
    checking: 'Checking your pass…',
    noPass: 'No valid pass',
    noPassText: 'The checkout needs the pass the waiting room gives you at your turn. A pass lasts 10 minutes.',
    back: 'Back to the drop',
  },
  'zh-TW': {
    name: '繁體中文',
    title: '有排隊室的搶票',
    intro: '500 個座位，所有人同時按下去。按下按鈕，你會和同一時間按下的人一起在真正的 Hibira 排隊室裡排隊，輪到你時帶著簽章通行證回到這裡。',
    event: 'Hibira Live · demo 場次',
    eventMeta: '500 個座位・每隔幾秒開一場',
    get: '搶票',
    going: '正在帶你去排隊…',
    inLine: '人正在排隊',
    taken: '個號碼已發出',
    closed: '這一場目前已關閉，請過一分鐘再試。',
    error: 'demo 目前連不上伺服器，請稍後再試。',
    howTitle: '流程',
    how1: '你會到託管的排隊頁面拿一個號碼。開賣前按下的人都會排進這一場。',
    how2: '隊伍依排隊室設定的速度前進，你的順位透過 WebSocket 即時更新。',
    how3: '輪到你時，頁面會帶著用 app 密鑰簽章的通行證送你回來，伺服器先驗證通行證才讓你結帳。',
    testTitle: '同樣的人潮，壓力測試結果',
    testText: '範例用 3,000 個買家在三秒內湧進商店，一次沒有排隊室，一次有排隊室。',
    colNo: '沒有排隊室',
    colWith: '有排隊室',
    rowSold: '賣出座位',
    rowOver: '超賣',
    rowFailed: '結帳失敗',
    source: '原始碼',
    product: '關於 Hibira 排隊室',
    all: '所有 demo',
    coTitle: '搶到了',
    coLead: '通行證驗證成功，這是你的座位。',
    section: '區',
    row: '排',
    seat: '號',
    number: '排隊號碼',
    verifiedTitle: '伺服器看到的內容',
    verifiedText: '@hibira-io/waiting-room 的 verifyPass() 用 app 密鑰檢查了通行證的簽章、排隊室和期限。',
    again: '再排一次',
    checking: '正在驗證通行證…',
    noPass: '沒有有效的通行證',
    noPassText: '結帳需要排隊室在輪到你時給的通行證，通行證 10 分鐘內有效。',
    back: '回到搶票頁',
  },
  'zh-CN': {
    name: '简体中文',
    title: '有排队室的抢票',
    intro: '500 个座位，所有人同时按下去。按下按钮，你会和同一时间按下的人一起在真正的 Hibira 排队室里排队，轮到你时带着签名通行证回到这里。',
    event: 'Hibira Live · demo 场次',
    eventMeta: '500 个座位・每隔几秒开一场',
    get: '抢票',
    going: '正在带你去排队…',
    inLine: '人正在排队',
    taken: '个号码已发出',
    closed: '这一场目前已关闭，请过一分钟再试。',
    error: 'demo 目前连不上服务器，请稍后再试。',
    howTitle: '流程',
    how1: '你会到托管的排队页面拿一个号码。开卖前按下的人都会排进这一场。',
    how2: '队伍按排队室设置的速度前进，你的位置通过 WebSocket 实时更新。',
    how3: '轮到你时，页面会带着用 app 密钥签名的通行证送你回来，服务器先验证通行证才让你结账。',
    testTitle: '同样的人潮，压力测试结果',
    testText: '示例用 3,000 个买家在三秒内涌进商店，一次没有排队室，一次有排队室。',
    colNo: '没有排队室',
    colWith: '有排队室',
    rowSold: '卖出座位',
    rowOver: '超卖',
    rowFailed: '结账失败',
    source: '源代码',
    product: '关于 Hibira 排队室',
    all: '所有 demo',
    coTitle: '抢到了',
    coLead: '通行证验证成功，这是你的座位。',
    section: '区',
    row: '排',
    seat: '号',
    number: '排队号码',
    verifiedTitle: '服务器看到的内容',
    verifiedText: '@hibira-io/waiting-room 的 verifyPass() 用 app 密钥检查了通行证的签名、排队室和有效期。',
    again: '再排一次',
    checking: '正在验证通行证…',
    noPass: '没有有效的通行证',
    noPassText: '结账需要排队室在轮到你时给的通行证，通行证 10 分钟内有效。',
    back: '回到抢票页',
  },
  ja: {
    name: '日本語',
    title: '待合室つきのチケット販売',
    intro: '500 席に全員が同時にアクセス。ボタンを押すと、同じ数秒間に押した人たちと一緒に本物の Hibira 待合室に並び、順番が来たら署名付きパスを持ってここに戻ってきます。',
    event: 'Hibira Live · デモ販売',
    eventMeta: '500 席・数秒ごとに新しい販売が始まります',
    get: 'チケットを取る',
    going: '列にご案内しています…',
    inLine: '人が並んでいます',
    taken: '件の整理番号を発行済み',
    closed: 'この販売は現在終了しています。1 分後にもう一度お試しください。',
    error: 'デモがサーバーに接続できません。少ししてからもう一度お試しください。',
    howTitle: '流れ',
    how1: 'ホスト型の待機ページで整理番号を受け取ります。販売開始前に押した人は全員この回に並びます。',
    how2: '列は待合室の設定した速さで進み、あなたの順番は WebSocket でリアルタイムに更新されます。',
    how3: '順番が来ると、アプリのシークレットで署名されたパスを持ってここに戻ります。サーバーはパスを確認してから購入手続きに進めます。',
    testTitle: '同じ混雑を負荷テストで',
    testText: 'サンプルでは 3,000 人の購入者が 3 秒でショップに押し寄せます。待合室なしと、待合室ありで 1 回ずつ。',
    colNo: '待合室なし',
    colWith: '待合室あり',
    rowSold: '販売した席',
    rowOver: '売りすぎ',
    rowFailed: '失敗した購入',
    source: 'ソースコード',
    product: 'Hibira 待合室について',
    all: 'すべてのデモ',
    coTitle: '取れました',
    coLead: 'パスを確認しました。あなたの席です。',
    section: 'ブロック',
    row: '列',
    seat: '番',
    number: '整理番号',
    verifiedTitle: 'サーバーが確認した内容',
    verifiedText: '@hibira-io/waiting-room の verifyPass() が、アプリのシークレットでパスの署名・待合室・有効期限を確認しました。',
    again: 'もう一度並ぶ',
    checking: 'パスを確認しています…',
    noPass: '有効なパスがありません',
    noPassText: '購入には、順番が来たときに待合室が発行するパスが必要です。パスの有効期限は 10 分です。',
    back: '販売ページに戻る',
  },
  ko: {
    name: '한국어',
    title: '대기실이 있는 티켓 오픈',
    intro: '500석에 모두가 동시에 몰립니다. 버튼을 누르면 같은 몇 초 사이에 누른 사람들과 함께 실제 Hibira 대기실에서 줄을 서고, 차례가 되면 서명된 패스를 들고 여기로 돌아옵니다.',
    event: 'Hibira Live · 데모 오픈',
    eventMeta: '500석 · 몇 초마다 새 오픈',
    get: '티켓 받기',
    going: '대기열로 안내하는 중…',
    inLine: '명이 대기 중',
    taken: '개의 대기 번호 발급',
    closed: '이번 오픈은 지금 닫혀 있어요. 1분 뒤에 다시 시도해 주세요.',
    error: '데모가 지금 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.',
    howTitle: '진행 방식',
    how1: '호스팅 대기 페이지로 이동해 대기 번호를 받습니다. 오픈 전에 누른 사람은 모두 이번 회차에 줄을 섭니다.',
    how2: '대기열은 대기실에 설정된 속도로 움직이고, 내 순서는 WebSocket으로 실시간 업데이트됩니다.',
    how3: '차례가 되면 앱 시크릿으로 서명된 패스를 들고 여기로 돌아옵니다. 서버는 결제 전에 패스를 확인합니다.',
    testTitle: '같은 몰림, 부하 테스트 결과',
    testText: '예제는 3초 동안 3,000명의 구매자를 쇼핑몰에 보냅니다. 대기실 없이 한 번, 대기실과 함께 한 번.',
    colNo: '대기실 없음',
    colWith: '대기실 있음',
    rowSold: '판매된 좌석',
    rowOver: '초과 판매',
    rowFailed: '실패한 결제',
    source: '소스 코드',
    product: 'Hibira 대기실 소개',
    all: '모든 데모',
    coTitle: '성공했어요',
    coLead: '패스가 확인됐어요. 내 좌석입니다.',
    section: '구역',
    row: '열',
    seat: '번',
    number: '대기 번호',
    verifiedTitle: '서버가 확인한 내용',
    verifiedText: '@hibira-io/waiting-room의 verifyPass()가 앱 시크릿으로 패스의 서명, 대기실, 만료 시간을 확인했어요.',
    again: '다시 줄 서기',
    checking: '패스를 확인하는 중…',
    noPass: '유효한 패스가 없어요',
    noPassText: '결제하려면 차례가 됐을 때 대기실이 주는 패스가 필요해요. 패스는 10분 동안 유효해요.',
    back: '티켓 페이지로 돌아가기',
  },
  th: {
    name: 'ไทย',
    title: 'เปิดขายตั๋วพร้อมห้องรอคิว',
    intro: '500 ที่นั่ง และทุกคนกดพร้อมกัน กดปุ่มแล้วคุณจะได้ต่อคิวในห้องรอคิว Hibira จริงๆ กับทุกคนที่กดในช่วงไม่กี่วินาทีเดียวกัน แล้วกลับมาที่นี่พร้อมบัตรผ่านที่มีลายเซ็น',
    event: 'Hibira Live · รอบเดโม',
    eventMeta: '500 ที่นั่ง · เปิดรอบใหม่ทุกไม่กี่วินาที',
    get: 'รับตั๋ว',
    going: 'กำลังพาไปต่อคิว…',
    inLine: 'คนกำลังรอคิว',
    taken: 'หมายเลขคิวที่แจกไปแล้ว',
    closed: 'รอบนี้ปิดอยู่ ลองใหม่อีกครั้งในหนึ่งนาที',
    error: 'เดโมเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ในตอนนี้ ลองใหม่อีกครั้งในอีกสักครู่',
    howTitle: 'ขั้นตอน',
    how1: 'คุณจะไปที่หน้ารอคิวที่ Hibira โฮสต์ไว้และรับหมายเลขคิว ทุกคนที่กดก่อนเปิดขายจะได้ที่ในรอบนี้',
    how2: 'คิวเดินตามอัตราของห้อง และลำดับของคุณอัปเดตสดผ่าน WebSocket',
    how3: 'เมื่อถึงคิว หน้าเว็บจะส่งคุณกลับมาพร้อมบัตรผ่านที่เซ็นด้วยคีย์ลับของแอป และเซิร์ฟเวอร์ตรวจสอบก่อนให้ชำระเงิน',
    testTitle: 'คนแห่มาเท่ากัน ในการทดสอบโหลด',
    testText: 'ตัวอย่างนี้ส่งผู้ซื้อ 3,000 คนเข้าร้านภายในสามวินาที ครั้งหนึ่งไม่มีห้องรอคิว อีกครั้งมีห้องรอคิว',
    colNo: 'ไม่มีห้องรอคิว',
    colWith: 'มีห้องรอคิว',
    rowSold: 'ที่นั่งที่ขายได้',
    rowOver: 'ขายเกิน',
    rowFailed: 'ชำระเงินไม่สำเร็จ',
    source: 'ซอร์สโค้ด',
    product: 'เกี่ยวกับห้องรอคิว Hibira',
    all: 'เดโมทั้งหมด',
    coTitle: 'ได้ตั๋วแล้ว',
    coLead: 'ตรวจสอบบัตรผ่านเรียบร้อย นี่คือที่นั่งของคุณ',
    section: 'โซน',
    row: 'แถว',
    seat: 'ที่นั่ง',
    number: 'หมายเลขคิว',
    verifiedTitle: 'สิ่งที่เซิร์ฟเวอร์เห็น',
    verifiedText: 'verifyPass() จาก @hibira-io/waiting-room ตรวจลายเซ็น ห้อง และเวลาหมดอายุของบัตรผ่านด้วยคีย์ลับของแอป',
    again: 'ต่อคิวอีกครั้ง',
    checking: 'กำลังตรวจสอบบัตรผ่าน…',
    noPass: 'ไม่มีบัตรผ่านที่ใช้ได้',
    noPassText: 'การชำระเงินต้องใช้บัตรผ่านที่ห้องรอคิวให้เมื่อถึงคิวของคุณ บัตรผ่านใช้ได้ 10 นาที',
    back: 'กลับไปหน้าขายตั๋ว',
  },
  vi: {
    name: 'Tiếng Việt',
    title: 'Mở bán vé với phòng chờ',
    intro: '500 ghế, và mọi người bấm cùng lúc. Bấm nút để xếp hàng trong một phòng chờ Hibira thật cùng mọi người bấm trong cùng vài giây, rồi quay lại đây với một vé thông hành có chữ ký.',
    event: 'Hibira Live · đợt mở bán demo',
    eventMeta: '500 ghế · cứ vài giây lại mở một đợt mới',
    get: 'Lấy vé',
    going: 'Đang đưa bạn vào hàng…',
    inLine: 'người đang xếp hàng',
    taken: 'số thứ tự đã phát',
    closed: 'Đợt này đang đóng. Hãy thử lại sau một phút.',
    error: 'Demo chưa kết nối được máy chủ. Hãy thử lại sau giây lát.',
    howTitle: 'Diễn ra thế nào',
    how1: 'Bạn đến trang chờ do Hibira lưu trữ và lấy số thứ tự. Ai bấm trước giờ mở bán đều có chỗ trong đợt này.',
    how2: 'Hàng di chuyển theo tốc độ của phòng, và vị trí của bạn cập nhật trực tiếp qua WebSocket.',
    how3: 'Đến lượt, trang đưa bạn quay lại đây với vé thông hành ký bằng khóa bí mật của ứng dụng, và máy chủ kiểm tra nó trước khi thanh toán.',
    testTitle: 'Cùng một đợt đổ xô, trong bài kiểm thử tải',
    testText: 'Ví dụ cho 3.000 người mua đổ vào cửa hàng trong ba giây, một lần không có phòng chờ và một lần có.',
    colNo: 'Không có phòng chờ',
    colWith: 'Có phòng chờ',
    rowSold: 'Ghế đã bán',
    rowOver: 'Bán vượt',
    rowFailed: 'Thanh toán thất bại',
    source: 'Mã nguồn',
    product: 'Về Hibira Waiting Room',
    all: 'Tất cả demo',
    coTitle: 'Bạn đã có vé',
    coLead: 'Vé thông hành hợp lệ. Đây là ghế của bạn.',
    section: 'Khu',
    row: 'Hàng',
    seat: 'Ghế',
    number: 'Số thứ tự',
    verifiedTitle: 'Máy chủ đã thấy gì',
    verifiedText: 'verifyPass() của @hibira-io/waiting-room đã kiểm tra chữ ký, phòng và hạn của vé thông hành bằng khóa bí mật của ứng dụng.',
    again: 'Xếp hàng lại',
    checking: 'Đang kiểm tra vé thông hành…',
    noPass: 'Không có vé thông hành hợp lệ',
    noPassText: 'Thanh toán cần vé thông hành mà phòng chờ đưa khi đến lượt bạn. Vé có hiệu lực 10 phút.',
    back: 'Quay lại trang bán vé',
  },
};
const LANGS = Object.keys(STRINGS);

function toLang(tag) {
  if (!tag) return null;
  const t = tag.toLowerCase();
  const exact = LANGS.find((l) => l.toLowerCase() === t);
  if (exact) return exact;
  if (t.startsWith('zh')) return /hans|cn|sg|my/.test(t) ? 'zh-CN' : 'zh-TW';
  return LANGS.find((l) => l === t.split('-')[0]) || null;
}

function detect() {
  const fromURL = toLang(new URLSearchParams(location.search).get('lang'));
  if (fromURL) return fromURL;
  try {
    const saved = toLang(localStorage.getItem('lang'));
    if (saved) return saved;
  } catch {}
  for (const tag of navigator.languages || [navigator.language]) {
    const lang = toLang(tag);
    if (lang) return lang;
  }
  return 'en';
}

export let lang = 'en';
export const t = (key) => STRINGS[lang][key] ?? STRINGS.en[key];

// Fills [data-t] elements and runs onChange after every language change.
export function setupLanguage(onChange = () => {}) {
  const menu = document.getElementById('lang');
  const list = menu.querySelector('ul');
  const toggle = menu.querySelector('button');
  const apply = (l) => {
    lang = l;
    document.documentElement.lang = l;
    for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
    menu.querySelector('button span').textContent = STRINGS[l].name;
    for (const li of list.children) li.setAttribute('aria-selected', String(li.dataset.lang === l));
    onChange(l);
  };
  const open = (on) => {
    menu.classList.toggle('open', on);
    toggle.setAttribute('aria-expanded', String(on));
    if (on) (list.querySelector('[aria-selected="true"]') || list.firstElementChild).focus();
  };
  const pick = (l) => {
    try {
      localStorage.setItem('lang', l);
    } catch {}
    apply(l);
    open(false);
    toggle.focus();
  };
  for (const l of LANGS) {
    const li = document.createElement('li');
    li.role = 'option';
    li.tabIndex = -1;
    li.dataset.lang = l;
    li.textContent = STRINGS[l].name;
    li.addEventListener('click', () => pick(l));
    list.appendChild(li);
  }
  toggle.addEventListener('click', () => open(!menu.classList.contains('open')));
  list.addEventListener('keydown', (e) => {
    const items = [...list.children];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (i >= 0) pick(items[i].dataset.lang);
    } else if (e.key === 'Escape') {
      open(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) open(false);
  });
  apply(detect());
}

export async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
