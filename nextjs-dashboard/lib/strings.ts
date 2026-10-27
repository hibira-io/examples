import type { Lang } from './i18n';

type State = 'connecting' | 'connected' | 'unavailable' | 'failed' | 'disconnected' | 'initialized';

const en = {
  language: 'Language',
  liveDemo: 'Live demo on Hibira',
  source: 'Source code',
  demoUnavailable: 'The demo is not available right now. Please try again later.',

  title: 'Live sales',
  realtimeOver: 'Realtime over',
  states: {
    connecting: 'connecting',
    connected: 'connected',
    unavailable: 'unavailable',
    failed: 'failed',
    disconnected: 'disconnected',
    initialized: 'initialized',
  } as Record<State, string>,
  startSimulator: 'Start simulator',
  stopSimulator: 'Stop simulator',
  publishFailed: (status: number) => `Publishing failed (${status}).`,
  hint: 'Start the simulator, then open this page in a second tab or on your phone: every open dashboard updates from the same events.',
  autoStop: (minutes: number) => `The simulator stops by itself after ${minutes} minutes.`,
  visitors: 'Visitors on the shop',
  orders: 'Orders',
  revenue: 'Revenue',
  watching: 'Watching this dashboard',
  visitorsChart: (seconds: number) => `Visitors, last ${seconds} s`,
  ordersPerSecond: 'Orders per second',
  latestOrders: 'Latest orders',
  noOrders: 'No orders yet.',
};

export type Strings = typeof en;

const zhTW: Strings = {
  language: '語言',
  liveDemo: '在 Hibira 上執行的即時 demo',
  source: '原始碼',
  demoUnavailable: 'demo 暫時無法使用，請稍後再試。',

  title: '即時銷售',
  realtimeOver: '即時連線：',
  states: { connecting: '連線中', connected: '已連線', unavailable: '無法連線', failed: '連線失敗', disconnected: '已中斷', initialized: '未連線' },
  startSimulator: '開始模擬',
  stopSimulator: '停止模擬',
  publishFailed: (status) => `發送失敗（${status}）。`,
  hint: '開始模擬後，在第二個分頁或手機上打開這個頁面：每個打開的儀表板都會收到同樣的事件一起更新。',
  autoStop: (minutes) => `模擬會在 ${minutes} 分鐘後自動停止。`,
  visitors: '商店訪客',
  orders: '訂單',
  revenue: '營收',
  watching: '正在看這個儀表板',
  visitorsChart: (seconds) => `訪客（最近 ${seconds} 秒）`,
  ordersPerSecond: '每秒訂單',
  latestOrders: '最新訂單',
  noOrders: '還沒有訂單。',
};

const zhCN: Strings = {
  language: '语言',
  liveDemo: '在 Hibira 上运行的实时 demo',
  source: '源代码',
  demoUnavailable: 'demo 暂时无法使用，请稍后再试。',

  title: '实时销售',
  realtimeOver: '实时连接：',
  states: { connecting: '连接中', connected: '已连接', unavailable: '无法连接', failed: '连接失败', disconnected: '已断开', initialized: '未连接' },
  startSimulator: '开始模拟',
  stopSimulator: '停止模拟',
  publishFailed: (status) => `发送失败（${status}）。`,
  hint: '开始模拟后，在第二个标签页或手机上打开这个页面：每个打开的仪表盘都会收到同样的事件一起更新。',
  autoStop: (minutes) => `模拟会在 ${minutes} 分钟后自动停止。`,
  visitors: '商店访客',
  orders: '订单',
  revenue: '营收',
  watching: '正在看这个仪表盘',
  visitorsChart: (seconds) => `访客（最近 ${seconds} 秒）`,
  ordersPerSecond: '每秒订单',
  latestOrders: '最新订单',
  noOrders: '还没有订单。',
};

const ja: Strings = {
  language: '言語',
  liveDemo: 'Hibira で動くライブデモ',
  source: 'ソースコード',
  demoUnavailable: 'デモは現在利用できません。しばらくしてからもう一度お試しください。',

  title: 'リアルタイム売上',
  realtimeOver: 'リアルタイム接続先：',
  states: { connecting: '接続中', connected: '接続済み', unavailable: '接続不可', failed: '接続失敗', disconnected: '切断', initialized: '未接続' },
  startSimulator: 'シミュレーター開始',
  stopSimulator: 'シミュレーター停止',
  publishFailed: (status) => `送信に失敗しました（${status}）。`,
  hint: 'シミュレーターを開始して、このページを別のタブやスマホでも開いてください。開いているダッシュボードはすべて同じイベントで更新されます。',
  autoStop: (minutes) => `シミュレーターは ${minutes} 分後に自動で止まります。`,
  visitors: 'ショップの訪問者',
  orders: '注文',
  revenue: '売上',
  watching: 'このダッシュボードを見ている人',
  visitorsChart: (seconds) => `訪問者（直近 ${seconds} 秒）`,
  ordersPerSecond: '毎秒の注文',
  latestOrders: '最新の注文',
  noOrders: 'まだ注文はありません。',
};

const ko: Strings = {
  language: '언어',
  liveDemo: 'Hibira에서 실행되는 라이브 데모',
  source: '소스 코드',
  demoUnavailable: '지금은 데모를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',

  title: '실시간 매출',
  realtimeOver: '실시간 연결:',
  states: { connecting: '연결 중', connected: '연결됨', unavailable: '연결 불가', failed: '연결 실패', disconnected: '연결 끊김', initialized: '연결 안 됨' },
  startSimulator: '시뮬레이터 시작',
  stopSimulator: '시뮬레이터 중지',
  publishFailed: (status) => `전송에 실패했습니다(${status}).`,
  hint: '시뮬레이터를 시작한 뒤 이 페이지를 다른 탭이나 휴대폰에서 열어 보세요. 열려 있는 모든 대시보드가 같은 이벤트로 함께 업데이트됩니다.',
  autoStop: (minutes) => `시뮬레이터는 ${minutes}분 후 자동으로 멈춥니다.`,
  visitors: '쇼핑몰 방문자',
  orders: '주문',
  revenue: '매출',
  watching: '이 대시보드를 보는 사람',
  visitorsChart: (seconds) => `방문자(최근 ${seconds}초)`,
  ordersPerSecond: '초당 주문',
  latestOrders: '최근 주문',
  noOrders: '아직 주문이 없습니다.',
};

const th: Strings = {
  language: 'ภาษา',
  liveDemo: 'เดโมสดที่ทำงานบน Hibira',
  source: 'ซอร์สโค้ด',
  demoUnavailable: 'ขณะนี้เดโมใช้งานไม่ได้ โปรดลองอีกครั้งภายหลัง',

  title: 'ยอดขายสด',
  realtimeOver: 'เชื่อมต่อแบบเรียลไทม์ผ่าน',
  states: { connecting: 'กำลังเชื่อมต่อ', connected: 'เชื่อมต่อแล้ว', unavailable: 'เชื่อมต่อไม่ได้', failed: 'เชื่อมต่อล้มเหลว', disconnected: 'ตัดการเชื่อมต่อ', initialized: 'ยังไม่เชื่อมต่อ' },
  startSimulator: 'เริ่มจำลอง',
  stopSimulator: 'หยุดจำลอง',
  publishFailed: (status) => `ส่งไม่สำเร็จ (${status})`,
  hint: 'เริ่มการจำลอง แล้วเปิดหน้านี้ในแท็บที่สองหรือบนมือถือ แดชบอร์ดทุกหน้าที่เปิดอยู่จะอัปเดตจากอีเวนต์เดียวกัน',
  autoStop: (minutes) => `การจำลองจะหยุดเองหลังจาก ${minutes} นาที`,
  visitors: 'ผู้เข้าชมร้าน',
  orders: 'คำสั่งซื้อ',
  revenue: 'รายได้',
  watching: 'กำลังดูแดชบอร์ดนี้',
  visitorsChart: (seconds) => `ผู้เข้าชม ${seconds} วินาทีล่าสุด`,
  ordersPerSecond: 'คำสั่งซื้อต่อวินาที',
  latestOrders: 'คำสั่งซื้อล่าสุด',
  noOrders: 'ยังไม่มีคำสั่งซื้อ',
};

const vi: Strings = {
  language: 'Ngôn ngữ',
  liveDemo: 'Demo trực tiếp chạy trên Hibira',
  source: 'Mã nguồn',
  demoUnavailable: 'Demo hiện không khả dụng. Vui lòng thử lại sau.',

  title: 'Doanh số trực tiếp',
  realtimeOver: 'Kết nối thời gian thực qua',
  states: { connecting: 'đang kết nối', connected: 'đã kết nối', unavailable: 'không kết nối được', failed: 'kết nối thất bại', disconnected: 'đã ngắt', initialized: 'chưa kết nối' },
  startSimulator: 'Bắt đầu mô phỏng',
  stopSimulator: 'Dừng mô phỏng',
  publishFailed: (status) => `Gửi thất bại (${status}).`,
  hint: 'Bắt đầu mô phỏng, rồi mở trang này ở tab thứ hai hoặc trên điện thoại: mọi bảng điều khiển đang mở đều cập nhật từ cùng một sự kiện.',
  autoStop: (minutes) => `Mô phỏng tự dừng sau ${minutes} phút.`,
  visitors: 'Khách trên cửa hàng',
  orders: 'Đơn hàng',
  revenue: 'Doanh thu',
  watching: 'Đang xem bảng này',
  visitorsChart: (seconds) => `Khách, ${seconds} giây gần nhất`,
  ordersPerSecond: 'Đơn hàng mỗi giây',
  latestOrders: 'Đơn hàng mới nhất',
  noOrders: 'Chưa có đơn hàng.',
};

export const STRINGS: Record<Lang, Strings> = { en, 'zh-TW': zhTW, 'zh-CN': zhCN, ja, ko, th, vi };
