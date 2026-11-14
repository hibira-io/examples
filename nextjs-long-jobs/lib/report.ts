// A stand-in for a slow job: it reads, groups and compares a month of
// orders, then writes a summary. Swap in your own work. streamToChannel()
// also takes an LLM SDK stream or a ReadableStream as it is.

import { type Lang, toLang } from './strings';

type Script = { steps: string[]; done: string; summary: string };

const SCRIPTS: Record<Lang, Script> = {
  en: {
    steps: ['Reading 48,210 orders from October…', 'Grouping by region and product…', 'Comparing with September…', 'Checking refunds…'],
    done: ' done',
    summary:
      'October revenue was $1.84M, up 12% on September. Asia-Pacific grew fastest at 21%, led by Japan and Taiwan, while Europe stayed flat. The top seller was the Aero backpack with 6,420 units. Refunds fell to 1.9% after the new size guide went live. Three products will sell out within ten days at the current rate.',
  },
  'zh-TW': {
    steps: ['讀取 10 月的 48,210 筆訂單…', '依地區和商品分組…', '和 9 月比較…', '檢查退款…'],
    done: ' 完成',
    summary:
      '10 月營收 184 萬美元，比 9 月成長 12%。亞太區成長最快，達 21%，主要來自日本和台灣，歐洲則持平。最暢銷的是 Aero 後背包，賣出 6,420 個。新的尺寸指南上線後，退款率降到 1.9%。照目前的速度，有三項商品會在十天內賣完。',
  },
  'zh-CN': {
    steps: ['读取 10 月的 48,210 笔订单…', '按地区和商品分组…', '与 9 月比较…', '检查退款…'],
    done: ' 完成',
    summary:
      '10 月营收 184 万美元，比 9 月增长 12%。亚太区增长最快，达 21%，主要来自日本和台湾，欧洲则持平。最畅销的是 Aero 双肩包，卖出 6,420 个。新的尺码指南上线后，退款率降到 1.9%。按目前的速度，有三款商品会在十天内卖完。',
  },
  ja: {
    steps: ['10 月の注文 48,210 件を読み込み中…', '地域と商品ごとに集計中…', '9 月と比較中…', '返金を確認中…'],
    done: ' 完了',
    summary:
      '10 月の売上は 184 万ドルで、9 月から 12% 増えました。最も伸びたのはアジア太平洋で 21%、日本と台湾がけん引し、ヨーロッパは横ばいでした。売れ筋 1 位は Aero バックパックで 6,420 個。新しいサイズガイドの公開後、返金率は 1.9% に下がりました。今のペースでは、3 つの商品が 10 日以内に売り切れます。',
  },
  ko: {
    steps: ['10월 주문 48,210건 읽는 중…', '지역과 상품별로 묶는 중…', '9월과 비교하는 중…', '환불 확인 중…'],
    done: ' 완료',
    summary:
      '10월 매출은 184만 달러로 9월보다 12% 늘었습니다. 아시아 태평양이 21%로 가장 많이 성장했고 일본과 대만이 이끌었으며, 유럽은 제자리였습니다. 가장 많이 팔린 상품은 Aero 백팩으로 6,420개입니다. 새 사이즈 가이드를 공개한 뒤 환불률은 1.9%로 내려갔습니다. 지금 속도라면 상품 세 개가 열흘 안에 품절됩니다.',
  },
  th: {
    steps: ['กำลังอ่านคำสั่งซื้อเดือนตุลาคม 48,210 รายการ…', 'กำลังจัดกลุ่มตามภูมิภาคและสินค้า…', 'กำลังเทียบกับเดือนกันยายน…', 'กำลังตรวจการคืนเงิน…'],
    done: ' เสร็จ',
    summary:
      'รายได้เดือนตุลาคมอยู่ที่ 1.84 ล้านดอลลาร์ เพิ่มขึ้น 12% จากเดือนกันยายน เอเชียแปซิฟิกโตเร็วที่สุดที่ 21% นำโดยญี่ปุ่นและไต้หวัน ส่วนยุโรปทรงตัว สินค้าขายดีที่สุดคือกระเป๋าเป้ Aero 6,420 ใบ หลังเปิดตัวคู่มือขนาดใหม่ อัตราการคืนเงินลดลงเหลือ 1.9% ด้วยอัตรานี้ สินค้าสามรายการจะขายหมดภายในสิบวัน',
  },
  vi: {
    steps: ['Đang đọc 48.210 đơn hàng tháng 10…', 'Đang nhóm theo khu vực và sản phẩm…', 'Đang so sánh với tháng 9…', 'Đang kiểm tra hoàn tiền…'],
    done: ' xong',
    summary:
      'Doanh thu tháng 10 đạt 1,84 triệu USD, tăng 12% so với tháng 9. Châu Á – Thái Bình Dương tăng nhanh nhất với 21%, dẫn đầu là Nhật Bản và Đài Loan, còn châu Âu đi ngang. Sản phẩm bán chạy nhất là ba lô Aero với 6.420 chiếc. Tỷ lệ hoàn tiền giảm còn 1,9% sau khi có hướng dẫn chọn cỡ mới. Với tốc độ hiện tại, ba sản phẩm sẽ hết hàng trong mười ngày.',
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The job's output, piece by piece, as it is produced. About 22 seconds in all. */
export async function* buildReport(lang: unknown): AsyncGenerator<string> {
  const s = SCRIPTS[toLang(String(lang ?? '')) ?? 'en'];
  for (const step of s.steps) {
    yield step;
    await sleep(2500);
    yield s.done + '\n';
  }
  yield '\n';
  // Languages without spaces get two characters at a time, the rest a word.
  const parts = /[぀-ヿ一-鿿฀-๿]/.test(s.summary) ? s.summary.match(/[\s\S]{1,2}/g)! : s.summary.split(/(?<= )/);
  for (const p of parts) {
    await sleep(Math.round(11000 / parts.length));
    yield p;
  }
}
