import type { Lang } from './i18n';

// The page's questions and answers, shown below the queue and given to
// search engines as FAQPage data (app/layout.tsx). The static HTML carries
// the zh-TW text; the browser swaps in the visitor's language.

export type Faq = { title: string; intro: string; items: [string, string][] };

const BRANDS = 'Claude Code、Sora、Manus、Perplexity、Cursor、Genspark、Lovable、Comet、Dia、Kiro、Windsurf、Replit、Bolt、v0、Kling（可靈）、海螺 Hailuo、Suno、ElevenLabs、Warp、Raycast、Granola、Kimi、豆包、Felo';
const BRANDS_EN = 'Claude Code, Sora, Manus, Perplexity, Cursor, Genspark, Lovable, Comet, Dia, Kiro, Windsurf, Replit, Bolt, v0, Kling, Hailuo, Suno, ElevenLabs, Warp, Raycast, Granola, Kimi, Doubao and Felo';

export const FAQ: Record<Lang, Faq> = {
  en: {
    title: 'Questions about the invite code queue',
    intro: `A free place to share spare invite codes and guest passes for ${BRANDS_EN}, and to line up for one. Codes go out in order, and everyone sees the line move in real time.`,
    items: [
      ['How do I get a Claude Code guest pass or another invite code?', 'Press "I want a code", sign in with the 6-digit code we email you, tick the products you want and get in line. When a code is yours we email you and the page shows it. You have 6 hours to take it before it moves to the next person.'],
      ['How do I share my spare invite codes?', 'Press "I want to share", sign in, pick the product and paste one code or invite link per line. Each code goes to the first person in line who wants that product.'],
      ['Which invite codes can I find here?', `${BRANDS_EN}. Only invites the product lets you give away for free.`],
      ['Is it free?', 'Yes. Getting and sharing codes is free, and there is nothing to buy.'],
      ['How do you stop fake codes?', 'Invite links must be on the product\'s own site, so made-up and phishing links are refused. A new giver has one code out at a time until someone says one of their codes worked. Anyone who gets a code that does not work can report it: they go back to the front of the line, and givers whose codes fail three times can no longer give codes.'],
      ['What can I not share?', 'No paid keys, gift cards, accounts or passwords, and no selling, buying or trading.'],
      ['Who runs this page?', 'Hibira, a hosted realtime WebSocket service. The live line, the counters and the chat room run on Hibira channels, and the source code is on GitHub.'],
      ['Can you add another product?', 'Yes. Tap "Want another product here?" under the invites, or the chat button in the corner, and tell us which one. Once we have checked that the product lets people give its invites away for free, we add it. If you make the product, list it yourself under "For vendors".'],
    ],
  },
  'zh-TW': {
    title: '排隊領邀請碼常見問題',
    intro: `免費分享和排隊領取 ${BRANDS} 的邀請碼與分享碼。邀請碼依序發出，隊伍怎麼動大家都即時看得到。`,
    items: [
      ['Claude Code 分享碼或其他邀請碼怎麼拿？', '按「我要領碼」，用寄到信箱的 6 位數驗證碼登入，勾選想要的產品後排隊。輪到你時會寄信通知，頁面也會顯示。你有 6 小時可以領取，逾時就會給下一個人。'],
      ['多的邀請碼怎麼分享？', '按「我要分享」，登入後選擇產品，每行貼一組邀請碼或邀請連結。每組碼會給隊伍中第一個想要這個產品的人。'],
      ['這裡有哪些邀請碼？', `${BRANDS}。只收產品本身允許免費送人的邀請碼。`],
      ['要收費嗎？', '不用。領碼和分享都免費，也沒有任何東西要買。'],
      ['怎麼防止假碼？', '邀請連結必須是產品官方網址，亂填的網址和釣魚連結會直接擋掉。第一次分享的人一次只能送一組，要有人回報可以用之後才能送更多。領到不能用的碼可以回報，回報的人會回到隊伍最前面；被回報三次的分享者會被停權。'],
      ['哪些東西不能分享？', '付費序號、禮品卡、帳號或密碼都不行，也禁止買賣或交換。'],
      ['這個頁面是誰做的？', 'Hibira，一個即時 WebSocket 託管服務。即時隊伍、人數統計和聊天室都跑在 Hibira 頻道上，原始碼放在 GitHub。'],
      ['可以加其他品牌嗎？', '可以。點邀請碼種類下面的「想加其他品牌？」，或右下角的聊天按鈕，告訴我們是哪一個。確認那個產品允許免費分享後就會加上。如果你是產品的廠商，可以直接到「廠商專區」自己上架。'],
    ],
  },
  'zh-CN': {
    title: '排队领邀请码常见问题',
    intro: `免费分享和排队领取 ${BRANDS} 的邀请码与分享码。邀请码按顺序发出，队伍怎么动大家都实时看得到。`,
    items: [
      ['Claude Code 分享码或其他邀请码怎么拿？', '点「我要领码」，用发到邮箱的 6 位数验证码登录，勾选想要的产品后排队。轮到你时会发邮件通知，页面也会显示。你有 6 小时可以领取，超时就会给下一个人。'],
      ['多的邀请码怎么分享？', '点「我要分享」，登录后选择产品，每行粘贴一个邀请码或邀请链接。每个码会给队伍中第一个想要这个产品的人。'],
      ['这里有哪些邀请码？', `${BRANDS}。只收产品本身允许免费送人的邀请码。`],
      ['要收费吗？', '不用。领码和分享都免费，也没有任何东西要买。'],
      ['怎么防止假码？', '邀请链接必须是产品官方网址，乱填的网址和钓鱼链接会直接拦下。第一次分享的人一次只能送一个，要有人反馈可以用之后才能送更多。领到不能用的码可以反馈，反馈的人会回到队伍最前面；被反馈三次的分享者会被停用。'],
      ['哪些东西不能分享？', '付费序列号、礼品卡、账号或密码都不行，也禁止买卖或交换。'],
      ['这个页面是谁做的？', 'Hibira，一个实时 WebSocket 托管服务。实时队伍、人数统计和聊天室都运行在 Hibira 频道上，源代码放在 GitHub。'],
      ['可以加其他品牌吗？', '可以。点邀请码种类下面的「想加其他品牌？」，或右下角的聊天按钮，告诉我们是哪一个。确认那个产品允许免费分享后就会加上。如果你是产品的厂商，可以直接到「厂商专区」自己上架。'],
    ],
  },
  ja: {
    title: '招待コードの順番待ちについて',
    intro: `${BRANDS_EN.replace(' and ', '、').replace(/, /g, '、')} の余った招待コードやゲストパスを無料で譲り合える場所です。コードは順番に配られ、列の動きは全員にリアルタイムで見えます。`,
    items: [
      ['Claude Code のゲストパスなどの招待コードはどうやってもらえますか？', '「コードがほしい」を押し、メールで届く 6 桁のコードでサインインして、ほしい製品を選んで列に並びます。順番が来たらメールでお知らせし、ページにも表示されます。6 時間以内に受け取らないと次の人に回ります。'],
      ['余った招待コードはどうやって譲れますか？', '「コードを譲りたい」を押してサインインし、製品を選んで 1 行に 1 つずつコードか招待リンクを貼ります。各コードは、その製品を待っている列の先頭の人に届きます。'],
      ['どの招待コードがありますか？', `${BRANDS_EN.replace(' and ', '、').replace(/, /g, '、')}。製品が無料で譲ることを認めている招待だけです。`],
      ['無料ですか？', 'はい。受け取るのも譲るのも無料で、買うものはありません。'],
      ['偽のコードはどう防いでいますか？', '招待リンクは製品の公式サイトのものに限り、でたらめなリンクやフィッシングリンクは受け付けません。初めて譲る人は 1 件ずつで、使えたと報告されるとまとめて譲れます。使えなかったコードは報告でき、報告した人は列の先頭に戻ります。3 回報告された人はコードを譲れなくなります。'],
      ['譲れないものは？', '有料のキー、ギフトカード、アカウントやパスワード、売買や交換は禁止です。'],
      ['このページは誰が運営していますか？', 'リアルタイム WebSocket のホスティングサービス Hibira です。列、人数、チャットは Hibira のチャンネルで動いていて、ソースコードは GitHub にあります。'],
      ['ほかのサービスも追加できますか？', 'できます。招待コードの種類の下にある「ほかのサービスも追加してほしい？」か、右下のチャットボタンからお知らせください。無料で譲ることが認められているサービスか確認したうえで追加します。サービスの提供者の方は「サービス提供者の方へ」から直接掲載できます。'],
    ],
  },
  ko: {
    title: '초대 코드 줄서기 자주 묻는 질문',
    intro: `${BRANDS_EN.replace(' and ', ', ')}의 남는 초대 코드와 게스트 패스를 무료로 나누고 줄 서서 받는 곳입니다. 코드는 순서대로 나가고, 줄이 움직이는 모습을 모두가 실시간으로 봅니다.`,
    items: [
      ['Claude Code 게스트 패스나 다른 초대 코드는 어떻게 받나요?', '"코드 받을래요"를 누르고 이메일로 받은 6자리 코드로 로그인한 뒤 원하는 제품을 골라 줄을 서세요. 차례가 되면 이메일로 알려 드리고 페이지에도 표시됩니다. 6시간 안에 받지 않으면 다음 사람에게 넘어갑니다.'],
      ['남는 초대 코드는 어떻게 나누나요?', '"나눌래요"를 누르고 로그인한 뒤 제품을 골라 한 줄에 코드나 초대 링크를 하나씩 붙여 넣으세요. 각 코드는 그 제품을 기다리는 줄의 맨 앞 사람에게 갑니다.'],
      ['어떤 초대 코드가 있나요?', `${BRANDS_EN.replace(' and ', ', ')}. 제품이 무료로 나누도록 허용한 초대만 받습니다.`],
      ['무료인가요?', '네. 받기와 나누기 모두 무료이고 살 것은 없습니다.'],
      ['가짜 코드는 어떻게 막나요?', '초대 링크는 제품 공식 사이트 주소여야 해서, 지어낸 링크나 피싱 링크는 거부됩니다. 처음 나누는 사람은 한 번에 하나씩만 나눌 수 있고, 작동했다는 응답을 받으면 더 나눌 수 있습니다. 작동하지 않는 코드는 신고할 수 있고, 신고한 사람은 줄 맨 앞으로 돌아갑니다. 세 번 신고된 사람은 더 이상 코드를 나눌 수 없습니다.'],
      ['나눌 수 없는 것은요?', '유료 키, 기프트 카드, 계정이나 비밀번호는 안 되며 판매, 구매, 교환도 금지입니다.'],
      ['이 페이지는 누가 운영하나요?', '실시간 WebSocket 호스팅 서비스 Hibira입니다. 줄, 인원 수, 채팅은 Hibira 채널에서 동작하고 소스 코드는 GitHub에 있습니다.'],
      ['다른 제품도 추가할 수 있나요?', '네. 초대 코드 종류 아래의 "다른 제품도 추가했으면 하나요?"나 오른쪽 아래 채팅 버튼으로 알려 주세요. 그 제품이 초대를 무료로 나누도록 허용하는지 확인한 뒤 추가합니다. 제품 운영사라면 "제품 운영사" 페이지에서 직접 등록할 수 있습니다.'],
    ],
  },
  th: {
    title: 'คำถามเกี่ยวกับคิวรับโค้ดเชิญ',
    intro: `ที่แบ่งปันและต่อคิวรับโค้ดเชิญกับ guest pass ของ ${BRANDS_EN.replace(' and ', ' และ ')} ฟรี โค้ดแจกตามลำดับ และทุกคนเห็นคิวขยับแบบเรียลไทม์`,
    items: [
      ['รับ guest pass ของ Claude Code หรือโค้ดเชิญอื่นได้อย่างไร?', 'กด "ฉันอยากได้โค้ด" ลงชื่อเข้าใช้ด้วยรหัส 6 หลักที่ส่งไปทางอีเมล เลือกผลิตภัณฑ์ที่อยากได้แล้วต่อคิว ถึงคิวเมื่อไรเราจะส่งอีเมลบอกและหน้าเว็บจะแสดงโค้ด คุณมีเวลา 6 ชั่วโมงก่อนโค้ดจะไปยังคนถัดไป'],
      ['แบ่งปันโค้ดเชิญที่เหลือได้อย่างไร?', 'กด "ฉันอยากแบ่งปัน" ลงชื่อเข้าใช้ เลือกผลิตภัณฑ์ แล้ววางโค้ดหรือลิงก์เชิญบรรทัดละหนึ่งรายการ แต่ละโค้ดจะไปถึงคนแรกในคิวที่อยากได้ผลิตภัณฑ์นั้น'],
      ['มีโค้ดเชิญอะไรบ้าง?', `${BRANDS_EN.replace(' and ', ' และ ')} รับเฉพาะคำเชิญที่ผลิตภัณฑ์อนุญาตให้แจกฟรี`],
      ['ฟรีไหม?', 'ฟรี ทั้งรับและแบ่งปัน ไม่มีอะไรต้องซื้อ'],
      ['ป้องกันโค้ดปลอมอย่างไร?', 'ลิงก์เชิญต้องอยู่บนเว็บไซต์ทางการของผลิตภัณฑ์ ลิงก์มั่วและลิงก์ฟิชชิงจะถูกปฏิเสธ ผู้แบ่งปันใหม่ส่งได้ทีละโค้ดจนกว่าจะมีคนบอกว่าใช้ได้ ใครได้โค้ดที่ใช้ไม่ได้แจ้งได้และจะกลับไปหน้าสุดของคิว ผู้ที่ถูกแจ้งสามครั้งจะแบ่งปันโค้ดไม่ได้อีก'],
      ['อะไรที่แบ่งปันไม่ได้?', 'คีย์แบบเสียเงิน บัตรของขวัญ บัญชีหรือรหัสผ่าน และห้ามซื้อขายหรือแลกเปลี่ยน'],
      ['ใครดูแลหน้านี้?', 'Hibira บริการโฮสต์ WebSocket แบบเรียลไทม์ คิว ตัวนับ และห้องแชตทำงานบนช่องของ Hibira และซอร์สโค้ดอยู่บน GitHub'],
      ['เพิ่มแบรนด์อื่นได้ไหม?', 'ได้ แตะ "อยากให้เพิ่มแบรนด์อื่น?" ใต้ประเภทโค้ดเชิญ หรือปุ่มแชตที่มุมขวาล่าง แล้วบอกเราว่าแบรนด์ไหน เมื่อตรวจแล้วว่าผลิตภัณฑ์นั้นอนุญาตให้แจกคำเชิญฟรี เราจะเพิ่มให้ หากคุณเป็นเจ้าของผลิตภัณฑ์ ลงรายการเองได้ที่หน้า "สำหรับเจ้าของผลิตภัณฑ์"'],
    ],
  },
  vi: {
    title: 'Câu hỏi về hàng chờ mã mời',
    intro: `Nơi miễn phí để chia sẻ mã mời và guest pass dư của ${BRANDS_EN.replace(' and ', ' và ')}, và xếp hàng nhận. Mã được phát theo thứ tự, ai cũng thấy hàng chờ di chuyển theo thời gian thực.`,
    items: [
      ['Làm sao nhận guest pass Claude Code hoặc mã mời khác?', 'Bấm "Tôi muốn nhận mã", đăng nhập bằng mã 6 số gửi qua email, chọn sản phẩm bạn muốn và xếp hàng. Đến lượt, chúng tôi gửi email và trang cũng hiện mã. Bạn có 6 giờ để nhận trước khi mã chuyển cho người tiếp theo.'],
      ['Làm sao chia sẻ mã mời dư?', 'Bấm "Tôi muốn chia sẻ", đăng nhập, chọn sản phẩm và dán mỗi dòng một mã hoặc liên kết mời. Mỗi mã đến với người đầu hàng đang muốn sản phẩm đó.'],
      ['Có những mã mời nào?', `${BRANDS_EN.replace(' and ', ' và ')}. Chỉ nhận lời mời mà sản phẩm cho phép tặng miễn phí.`],
      ['Có miễn phí không?', 'Có. Nhận và chia sẻ đều miễn phí, không có gì phải mua.'],
      ['Làm sao chặn mã giả?', 'Liên kết mời phải thuộc trang chính thức của sản phẩm, nên liên kết bịa và liên kết lừa đảo bị từ chối. Người mới chỉ tặng từng mã một cho đến khi có người báo mã dùng được. Ai nhận mã không dùng được có thể báo lại và được về đầu hàng; người bị báo ba lần không thể tặng mã nữa.'],
      ['Những gì không được chia sẻ?', 'Không khóa trả phí, thẻ quà tặng, tài khoản hay mật khẩu, và không mua bán hay trao đổi.'],
      ['Ai vận hành trang này?', 'Hibira, dịch vụ WebSocket thời gian thực được lưu trữ. Hàng chờ, bộ đếm và phòng chat chạy trên kênh Hibira, mã nguồn có trên GitHub.'],
      ['Có thể thêm sản phẩm khác không?', 'Có. Bấm "Muốn thêm sản phẩm khác?" dưới mục loại mã mời, hoặc nút chat ở góc phải dưới, và cho chúng tôi biết sản phẩm nào. Sau khi kiểm tra sản phẩm đó cho phép tặng lời mời miễn phí, chúng tôi sẽ thêm vào. Nếu bạn làm ra sản phẩm, hãy tự đăng ở mục "Dành cho nhà cung cấp".'],
    ],
  },
};
