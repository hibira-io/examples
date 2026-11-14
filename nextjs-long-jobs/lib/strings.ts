export const LANGS = ['en', 'zh-TW', 'zh-CN', 'ja', 'ko', 'th', 'vi'] as const;
export type Lang = (typeof LANGS)[number];

/** The closest supported language to a BCP 47 tag, or null. */
export function toLang(tag: string | null | undefined): Lang | null {
  if (!tag) return null;
  const t = tag.toLowerCase();
  if (t.startsWith('zh')) return /tw|hk|mo|hant/.test(t) ? 'zh-TW' : 'zh-CN';
  return LANGS.find((l) => t === l.toLowerCase() || t.startsWith(l.toLowerCase() + '-')) ?? null;
}

export type Strings = {
  title: string;
  tagline: string;
  build: string;
  building: string;
  waiting: string;
  answered: string;
  doneIn: string;
  failed: string;
  tabs: string;
  oldWay: string;
  newWay: string;
  empty: string;
};

export const STRINGS: Record<Lang, Strings> = {
  en: {
    title: 'October sales report',
    tagline: 'Built on the server, shown here line by line.',
    build: 'Build report',
    building: 'Building…',
    waiting: 'Waiting for the server… {s} s',
    answered: 'Request answered in {ms} ms',
    doneIn: 'Done in {s} s',
    failed: 'Request failed: {status} after {s} s',
    tabs: 'Every open tab shows the same report.',
    oldWay: 'Wait for the whole job',
    newWay: 'Stream it',
    empty: 'No report yet.',
  },
  'zh-TW': {
    title: '10 月銷售報告',
    tagline: '在伺服器上產生，一行一行顯示在這裡。',
    build: '產生報告',
    building: '產生中…',
    waiting: '等待伺服器… {s} 秒',
    answered: '請求在 {ms} 毫秒內回應',
    doneIn: '{s} 秒完成',
    failed: '請求失敗：{s} 秒後 {status}',
    tabs: '每個開著的分頁都顯示同一份報告。',
    oldWay: '等整個工作做完',
    newWay: '串流顯示',
    empty: '還沒有報告。',
  },
  'zh-CN': {
    title: '10 月销售报告',
    tagline: '在服务器上生成，一行一行显示在这里。',
    build: '生成报告',
    building: '生成中…',
    waiting: '等待服务器… {s} 秒',
    answered: '请求在 {ms} 毫秒内响应',
    doneIn: '{s} 秒完成',
    failed: '请求失败：{s} 秒后 {status}',
    tabs: '每个打开的标签页都显示同一份报告。',
    oldWay: '等整个任务完成',
    newWay: '流式显示',
    empty: '还没有报告。',
  },
  ja: {
    title: '10 月の売上レポート',
    tagline: 'サーバーで作成し、ここに 1 行ずつ表示します。',
    build: 'レポートを作成',
    building: '作成中…',
    waiting: 'サーバーを待っています… {s} 秒',
    answered: 'リクエストは {ms} ms で応答',
    doneIn: '{s} 秒で完了',
    failed: 'リクエスト失敗：{s} 秒後に {status}',
    tabs: '開いているすべてのタブに同じレポートが表示されます。',
    oldWay: '処理が全部終わるまで待つ',
    newWay: 'ストリーミング',
    empty: 'まだレポートはありません。',
  },
  ko: {
    title: '10월 매출 보고서',
    tagline: '서버에서 만들고 여기에 한 줄씩 보여 줍니다.',
    build: '보고서 만들기',
    building: '만드는 중…',
    waiting: '서버를 기다리는 중… {s}초',
    answered: '요청이 {ms}ms 만에 응답',
    doneIn: '{s}초 만에 완료',
    failed: '요청 실패: {s}초 후 {status}',
    tabs: '열려 있는 모든 탭에 같은 보고서가 보입니다.',
    oldWay: '작업이 끝날 때까지 기다리기',
    newWay: '스트리밍',
    empty: '아직 보고서가 없습니다.',
  },
  th: {
    title: 'รายงานยอดขายเดือนตุลาคม',
    tagline: 'สร้างบนเซิร์ฟเวอร์ แสดงที่นี่ทีละบรรทัด',
    build: 'สร้างรายงาน',
    building: 'กำลังสร้าง…',
    waiting: 'กำลังรอเซิร์ฟเวอร์… {s} วินาที',
    answered: 'คำขอตอบกลับใน {ms} มิลลิวินาที',
    doneIn: 'เสร็จใน {s} วินาที',
    failed: 'คำขอล้มเหลว: {status} หลัง {s} วินาที',
    tabs: 'ทุกแท็บที่เปิดอยู่แสดงรายงานเดียวกัน',
    oldWay: 'รอให้งานเสร็จทั้งหมด',
    newWay: 'สตรีม',
    empty: 'ยังไม่มีรายงาน',
  },
  vi: {
    title: 'Báo cáo doanh số tháng 10',
    tagline: 'Tạo trên máy chủ, hiện ở đây từng dòng.',
    build: 'Tạo báo cáo',
    building: 'Đang tạo…',
    waiting: 'Đang chờ máy chủ… {s} giây',
    answered: 'Yêu cầu được trả lời trong {ms} ms',
    doneIn: 'Xong trong {s} giây',
    failed: 'Yêu cầu thất bại: {status} sau {s} giây',
    tabs: 'Mọi tab đang mở đều hiện cùng một báo cáo.',
    oldWay: 'Chờ cả tác vụ xong',
    newWay: 'Phát trực tiếp',
    empty: 'Chưa có báo cáo.',
  },
};

export const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
