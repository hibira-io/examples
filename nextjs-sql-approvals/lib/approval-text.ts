// What the supervisor reads on the Hibira-hosted approval page, in the
// visitor's language. The statement itself stays as written.

const TEXT = {
  en: { title: 'Run this database change?', rows: 'Estimated rows', plan: 'Plan', approve: 'Approve', reject: 'Reject' },
  'zh-TW': { title: '要執行這項資料庫變更嗎？', rows: '預計影響筆數', plan: '執行計畫', approve: '核准', reject: '拒絕' },
  'zh-CN': { title: '要执行这项数据库变更吗？', rows: '预计影响行数', plan: '执行计划', approve: '批准', reject: '拒绝' },
  ja: { title: 'このデータベース変更を実行しますか？', rows: '影響する見込みの行数', plan: '実行計画', approve: '承認', reject: '却下' },
  ko: { title: '이 데이터베이스 변경을 실행할까요?', rows: '예상 영향 행 수', plan: '실행 계획', approve: '승인', reject: '거절' },
  th: { title: 'เรียกใช้การเปลี่ยนแปลงฐานข้อมูลนี้ไหม', rows: 'จำนวนแถวที่คาดว่าจะได้รับผล', plan: 'แผนการทำงาน', approve: 'อนุมัติ', reject: 'ปฏิเสธ' },
  vi: { title: 'Chạy thay đổi cơ sở dữ liệu này?', rows: 'Số dòng dự kiến bị ảnh hưởng', plan: 'Kế hoạch thực thi', approve: 'Phê duyệt', reject: 'Từ chối' },
} as const;

export function approvalText(lang: string) {
  return TEXT[lang as keyof typeof TEXT] ?? TEXT.en;
}
