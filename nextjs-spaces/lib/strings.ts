import type { Lang } from './i18n';

type SectionId = 'trip' | 'budget' | 'notes';
type FieldId = 'title' | 'destination' | 'dates' | 'flights' | 'hotel' | 'food' | 'packing' | 'ideas';

const en = {
  language: 'Language',
  liveDemo: 'Live demo on Hibira',
  source: 'Source code',
  demoUnavailable: 'The demo is not available right now. Please try again later.',

  title: 'Shared trip planner',
  plan: 'Plan',
  // "Open <this link> in another tab…": the spaces around the link are in the strings.
  openBefore: 'Open ',
  thisLink: 'this link',
  openAfter: ' in another tab or on your phone to plan together.',
  whosHere: "Who's here",
  you: (name: string) => `${name} (you)`,
  follow: (name: string) => `Follow ${name}`,
  following: (name: string) => `Following ${name}.`,
  stop: 'Stop',
  editing: (name: string) => `${name} is editing`,
  fieldLocked: (name: string) => `${name} is editing this field.`,
  someone: 'Someone',
  help: "Click someone's avatar to follow them between sections. A field someone is typing in is locked for everyone else until they leave it.",
  sections: { trip: 'Trip', budget: 'Budget', notes: 'Notes' } as Record<SectionId, string>,
  fields: {
    title: 'Trip name',
    destination: 'Destination',
    dates: 'Dates',
    flights: 'Flights',
    hotel: 'Hotel',
    food: 'Food and fun',
    packing: 'Packing list',
    ideas: 'Ideas',
  } as Record<FieldId, string>,
};

export type Strings = typeof en;

const zhTW: Strings = {
  language: '語言',
  liveDemo: '在 Hibira 上執行的即時 demo',
  source: '原始碼',
  demoUnavailable: 'demo 暫時無法使用，請稍後再試。',

  title: '共同旅遊規劃',
  plan: '規劃',
  openBefore: '在另一個分頁或手機上打開',
  thisLink: '這個連結',
  openAfter: '，一起規劃。',
  whosHere: '誰在這裡',
  you: (name) => `${name}（你）`,
  follow: (name) => `跟隨 ${name}`,
  following: (name) => `正在跟隨 ${name}。`,
  stop: '停止',
  editing: (name) => `${name} 正在編輯`,
  fieldLocked: (name) => `${name} 正在編輯這個欄位。`,
  someone: '某人',
  help: '點別人的頭像就能跟著他切換分頁。有人正在輸入的欄位，其他人要等他離開後才能編輯。',
  sections: { trip: '行程', budget: '預算', notes: '筆記' },
  fields: { title: '旅程名稱', destination: '目的地', dates: '日期', flights: '機票', hotel: '住宿', food: '吃喝玩樂', packing: '行李清單', ideas: '點子' },
};

const zhCN: Strings = {
  language: '语言',
  liveDemo: '在 Hibira 上运行的实时 demo',
  source: '源代码',
  demoUnavailable: 'demo 暂时无法使用，请稍后再试。',

  title: '共同旅行规划',
  plan: '规划',
  openBefore: '在另一个标签页或手机上打开',
  thisLink: '这个链接',
  openAfter: '，一起规划。',
  whosHere: '谁在这里',
  you: (name) => `${name}（你）`,
  follow: (name) => `跟随 ${name}`,
  following: (name) => `正在跟随 ${name}。`,
  stop: '停止',
  editing: (name) => `${name} 正在编辑`,
  fieldLocked: (name) => `${name} 正在编辑这个字段。`,
  someone: '某人',
  help: '点别人的头像就能跟着他切换分区。有人正在输入的字段，其他人要等他离开后才能编辑。',
  sections: { trip: '行程', budget: '预算', notes: '笔记' },
  fields: { title: '旅程名称', destination: '目的地', dates: '日期', flights: '机票', hotel: '住宿', food: '吃喝玩乐', packing: '行李清单', ideas: '点子' },
};

const ja: Strings = {
  language: '言語',
  liveDemo: 'Hibira で動くライブデモ',
  source: 'ソースコード',
  demoUnavailable: 'デモは現在利用できません。しばらくしてからもう一度お試しください。',

  title: 'みんなで旅行プランナー',
  plan: 'プラン',
  openBefore: '',
  thisLink: 'このリンク',
  openAfter: 'を別のタブやスマホで開くと、一緒に計画できます。',
  whosHere: '参加中のメンバー',
  you: (name) => `${name}（あなた）`,
  follow: (name) => `${name} をフォロー`,
  following: (name) => `${name} をフォロー中。`,
  stop: 'やめる',
  editing: (name) => `${name} が編集中`,
  fieldLocked: (name) => `${name} がこの項目を編集中です。`,
  someone: '誰か',
  help: 'アバターをクリックすると、その人のいるセクションについて行けます。誰かが入力中の項目は、その人が離れるまで他の人は編集できません。',
  sections: { trip: '旅程', budget: '予算', notes: 'メモ' },
  fields: { title: '旅行名', destination: '行き先', dates: '日程', flights: '航空券', hotel: 'ホテル', food: '食事・遊び', packing: '持ち物リスト', ideas: 'アイデア' },
};

const ko: Strings = {
  language: '언어',
  liveDemo: 'Hibira에서 실행되는 라이브 데모',
  source: '소스 코드',
  demoUnavailable: '지금은 데모를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',

  title: '함께 짜는 여행 계획',
  plan: '계획',
  openBefore: '',
  thisLink: '이 링크',
  openAfter: '를 다른 탭이나 휴대폰에서 열어 함께 계획하세요.',
  whosHere: '참여 중인 사람',
  you: (name) => `${name}(나)`,
  follow: (name) => `${name}님 따라가기`,
  following: (name) => `${name}님을 따라가는 중.`,
  stop: '그만',
  editing: (name) => `${name}님이 편집 중`,
  fieldLocked: (name) => `${name}님이 이 항목을 편집하고 있습니다.`,
  someone: '누군가',
  help: '다른 사람의 아바타를 누르면 그 사람이 있는 섹션을 따라갑니다. 누군가 입력 중인 항목은 그 사람이 나갈 때까지 다른 사람이 편집할 수 없습니다.',
  sections: { trip: '여행', budget: '예산', notes: '메모' },
  fields: { title: '여행 이름', destination: '목적지', dates: '날짜', flights: '항공권', hotel: '숙소', food: '식비와 놀거리', packing: '짐 목록', ideas: '아이디어' },
};

const th: Strings = {
  language: 'ภาษา',
  liveDemo: 'เดโมสดที่ทำงานบน Hibira',
  source: 'ซอร์สโค้ด',
  demoUnavailable: 'ขณะนี้เดโมใช้งานไม่ได้ โปรดลองอีกครั้งภายหลัง',

  title: 'วางแผนเที่ยวด้วยกัน',
  plan: 'แผน',
  openBefore: 'เปิด',
  thisLink: 'ลิงก์นี้',
  openAfter: ' ในแท็บอื่นหรือบนมือถือเพื่อวางแผนด้วยกัน',
  whosHere: 'ใครอยู่ที่นี่',
  you: (name) => `${name} (คุณ)`,
  follow: (name) => `ติดตาม ${name}`,
  following: (name) => `กำลังติดตาม ${name}`,
  stop: 'หยุด',
  editing: (name) => `${name} กำลังแก้ไข`,
  fieldLocked: (name) => `${name} กำลังแก้ไขช่องนี้`,
  someone: 'ใครบางคน',
  help: 'คลิกอวตารของใครก็ได้เพื่อติดตามเขาไปทุกหัวข้อ ช่องที่มีคนกำลังพิมพ์จะถูกล็อกไว้จนกว่าเขาจะออกจากช่องนั้น',
  sections: { trip: 'ทริป', budget: 'งบประมาณ', notes: 'โน้ต' },
  fields: { title: 'ชื่อทริป', destination: 'จุดหมาย', dates: 'วันที่', flights: 'ตั๋วเครื่องบิน', hotel: 'ที่พัก', food: 'กินเที่ยว', packing: 'ของที่ต้องเตรียม', ideas: 'ไอเดีย' },
};

const vi: Strings = {
  language: 'Ngôn ngữ',
  liveDemo: 'Demo trực tiếp chạy trên Hibira',
  source: 'Mã nguồn',
  demoUnavailable: 'Demo hiện không khả dụng. Vui lòng thử lại sau.',

  title: 'Lên kế hoạch du lịch cùng nhau',
  plan: 'Kế hoạch',
  openBefore: 'Mở ',
  thisLink: 'liên kết này',
  openAfter: ' ở tab khác hoặc trên điện thoại để lên kế hoạch cùng nhau.',
  whosHere: 'Ai đang ở đây',
  you: (name) => `${name} (bạn)`,
  follow: (name) => `Theo dõi ${name}`,
  following: (name) => `Đang theo dõi ${name}.`,
  stop: 'Dừng',
  editing: (name) => `${name} đang sửa`,
  fieldLocked: (name) => `${name} đang sửa ô này.`,
  someone: 'Ai đó',
  help: 'Bấm vào ảnh đại diện của ai đó để theo họ qua các mục. Ô có người đang gõ sẽ bị khóa với mọi người khác cho đến khi họ rời ô đó.',
  sections: { trip: 'Chuyến đi', budget: 'Ngân sách', notes: 'Ghi chú' },
  fields: { title: 'Tên chuyến đi', destination: 'Điểm đến', dates: 'Ngày', flights: 'Vé máy bay', hotel: 'Khách sạn', food: 'Ăn uống, vui chơi', packing: 'Đồ cần mang', ideas: 'Ý tưởng' },
};

export const STRINGS: Record<Lang, Strings> = { en, 'zh-TW': zhTW, 'zh-CN': zhCN, ja, ko, th, vi };
