import type { Lang } from './i18n';

// Draw & guess. The host (the earliest player, @hibira-io/lobby) runs the
// rounds and keeps the scores; the drawer's strokes and everyone's guesses
// are client events. The word never travels in the clear while it is being
// guessed: the drawer sends hashes of its accepted spellings, salted with
// the room and round, and each guesser checks a guess against them before
// sending it, so a right answer is never shown in the chat.

export const STATE_EVENT = 'client-draw-state';
export const WORD_EVENT = 'client-draw-word';
export const STROKES_EVENT = 'client-draw-strokes';
export const CLEAR_EVENT = 'client-draw-clear';
export const CORRECT_EVENT = 'client-draw-correct';
export const REVEAL_EVENT = 'client-draw-reveal';

export const ROUND_MS = 80_000;
export const REVEAL_MS = 5_000;
/** How often the drawer sends the points drawn since the last batch. */
export const BATCH_MS = 150;
/** Points are scaled to 0–1000 on both axes, whatever the canvas size. */
export const SCALE = 1000;

export const COLORS = ['#14161f', '#e50000', '#e59500', '#02be01', '#0083c7', '#820080', '#ffffff'];
export const WIDTHS = [4, 10, 24];

export interface DrawState {
  round: number;
  phase: 'waiting' | 'drawing' | 'reveal';
  drawer: string | null;
  /** ms left in the phase when the host sent it (clocks differ between browsers). */
  left: number;
  scores: Record<string, number>;
  guessed: string[];
}

/** Part of a stroke: points (x, y, x, y, …) to add to stroke `id`. */
export interface StrokePart {
  id: string;
  c: number;
  w: number;
  p: number[];
}

/** Points for the n-th right guess (from 0), and for the drawer per right guess. */
export function guessPoints(n: number): number {
  return Math.max(10 - 2 * n, 4);
}
export const DRAWER_POINTS = 2;

/** The player who draws after `current`, in seat order. */
export function nextDrawer(players: string[], current: string | null): string | null {
  if (players.length === 0) return null;
  const i = current ? players.indexOf(current) : -1;
  return players[(i + 1) % players.length];
}

// Each word in the seven languages; '|' separates other accepted answers,
// the first is the one shown. A guess in any language counts.
type Word = Record<Lang, string>;

export const WORDS: Word[] = [
  { en: 'cat', 'zh-TW': '貓', 'zh-CN': '猫', ja: '猫|ねこ', ko: '고양이', th: 'แมว', vi: 'con mèo|mèo' },
  { en: 'dog', 'zh-TW': '狗', 'zh-CN': '狗', ja: '犬|いぬ', ko: '개|강아지', th: 'หมา|สุนัข', vi: 'con chó|chó' },
  { en: 'fish', 'zh-TW': '魚', 'zh-CN': '鱼', ja: '魚|さかな', ko: '물고기', th: 'ปลา', vi: 'con cá|cá' },
  { en: 'bird', 'zh-TW': '鳥', 'zh-CN': '鸟', ja: '鳥|とり', ko: '새', th: 'นก', vi: 'con chim|chim' },
  { en: 'house', 'zh-TW': '房子|房屋', 'zh-CN': '房子', ja: '家|いえ', ko: '집', th: 'บ้าน', vi: 'ngôi nhà|nhà' },
  { en: 'tree', 'zh-TW': '樹', 'zh-CN': '树', ja: '木|き', ko: '나무', th: 'ต้นไม้', vi: 'cái cây|cây' },
  { en: 'sun', 'zh-TW': '太陽', 'zh-CN': '太阳', ja: '太陽|たいよう', ko: '태양|해', th: 'ดวงอาทิตย์|พระอาทิตย์', vi: 'mặt trời' },
  { en: 'moon', 'zh-TW': '月亮', 'zh-CN': '月亮', ja: '月|つき', ko: '달', th: 'พระจันทร์|ดวงจันทร์', vi: 'mặt trăng' },
  { en: 'star', 'zh-TW': '星星', 'zh-CN': '星星', ja: '星|ほし', ko: '별', th: 'ดาว|ดวงดาว', vi: 'ngôi sao|sao' },
  { en: 'car', 'zh-TW': '汽車|車子|車', 'zh-CN': '汽车|车', ja: '車|くるま', ko: '자동차|차', th: 'รถยนต์|รถ', vi: 'xe hơi|ô tô' },
  { en: 'bicycle|bike', 'zh-TW': '腳踏車|自行車', 'zh-CN': '自行车', ja: '自転車|じてんしゃ', ko: '자전거', th: 'จักรยาน', vi: 'xe đạp' },
  { en: 'apple', 'zh-TW': '蘋果', 'zh-CN': '苹果', ja: 'りんご|林檎', ko: '사과', th: 'แอปเปิล|แอปเปิ้ล', vi: 'quả táo|táo' },
  { en: 'banana', 'zh-TW': '香蕉', 'zh-CN': '香蕉', ja: 'バナナ', ko: '바나나', th: 'กล้วย', vi: 'quả chuối|chuối' },
  { en: 'umbrella', 'zh-TW': '雨傘|傘', 'zh-CN': '雨伞|伞', ja: '傘|かさ', ko: '우산', th: 'ร่ม', vi: 'cái ô|ô|dù' },
  { en: 'clock', 'zh-TW': '時鐘', 'zh-CN': '时钟', ja: '時計|とけい', ko: '시계', th: 'นาฬิกา', vi: 'đồng hồ' },
  { en: 'cake', 'zh-TW': '蛋糕', 'zh-CN': '蛋糕', ja: 'ケーキ', ko: '케이크', th: 'เค้ก', vi: 'bánh kem|bánh ngọt' },
  { en: 'pizza', 'zh-TW': '披薩', 'zh-CN': '披萨', ja: 'ピザ', ko: '피자', th: 'พิซซ่า', vi: 'bánh pizza|pizza' },
  { en: 'flower', 'zh-TW': '花', 'zh-CN': '花', ja: '花|はな', ko: '꽃', th: 'ดอกไม้', vi: 'bông hoa|hoa' },
  { en: 'mountain', 'zh-TW': '山', 'zh-CN': '山', ja: '山|やま', ko: '산', th: 'ภูเขา', vi: 'ngọn núi|núi' },
  { en: 'rainbow', 'zh-TW': '彩虹', 'zh-CN': '彩虹', ja: '虹|にじ', ko: '무지개', th: 'รุ้ง|สายรุ้ง', vi: 'cầu vồng' },
  { en: 'phone', 'zh-TW': '手機|電話', 'zh-CN': '手机|电话', ja: '電話|スマホ|でんわ', ko: '휴대폰|전화', th: 'โทรศัพท์', vi: 'điện thoại' },
  { en: 'glasses', 'zh-TW': '眼鏡', 'zh-CN': '眼镜', ja: '眼鏡|めがね', ko: '안경', th: 'แว่นตา|แว่น', vi: 'mắt kính|kính' },
  { en: 'hat', 'zh-TW': '帽子', 'zh-CN': '帽子', ja: '帽子|ぼうし', ko: '모자', th: 'หมวก', vi: 'cái mũ|mũ|nón' },
  { en: 'shoe|shoes', 'zh-TW': '鞋子|鞋', 'zh-CN': '鞋子|鞋', ja: '靴|くつ', ko: '신발', th: 'รองเท้า', vi: 'đôi giày|giày' },
  { en: 'key', 'zh-TW': '鑰匙', 'zh-CN': '钥匙', ja: '鍵|かぎ', ko: '열쇠', th: 'กุญแจ', vi: 'chìa khóa' },
  { en: 'book', 'zh-TW': '書', 'zh-CN': '书', ja: '本|ほん', ko: '책', th: 'หนังสือ', vi: 'quyển sách|sách' },
  { en: 'guitar', 'zh-TW': '吉他', 'zh-CN': '吉他', ja: 'ギター', ko: '기타', th: 'กีตาร์', vi: 'đàn guitar|guitar|đàn ghi ta' },
  { en: 'rocket', 'zh-TW': '火箭', 'zh-CN': '火箭', ja: 'ロケット', ko: '로켓', th: 'จรวด', vi: 'tên lửa' },
  { en: 'train', 'zh-TW': '火車', 'zh-CN': '火车', ja: '電車|列車|でんしゃ', ko: '기차', th: 'รถไฟ', vi: 'tàu hỏa|xe lửa' },
  { en: 'boat|ship', 'zh-TW': '船', 'zh-CN': '船', ja: '船|ふね', ko: '배', th: 'เรือ', vi: 'con thuyền|thuyền' },
  { en: 'ice cream', 'zh-TW': '冰淇淋', 'zh-CN': '冰淇淋', ja: 'アイスクリーム|アイス', ko: '아이스크림', th: 'ไอศกรีม|ไอติม', vi: 'kem' },
  { en: 'snowman', 'zh-TW': '雪人', 'zh-CN': '雪人', ja: '雪だるま|ゆきだるま', ko: '눈사람', th: 'ตุ๊กตาหิมะ|มนุษย์หิมะ', vi: 'người tuyết' },
  { en: 'robot', 'zh-TW': '機器人', 'zh-CN': '机器人', ja: 'ロボット', ko: '로봇', th: 'หุ่นยนต์', vi: 'người máy|robot' },
  { en: 'heart', 'zh-TW': '愛心|心', 'zh-CN': '爱心|心', ja: 'ハート', ko: '하트', th: 'หัวใจ', vi: 'trái tim|tim' },
  { en: 'ghost', 'zh-TW': '幽靈|鬼', 'zh-CN': '幽灵|鬼', ja: 'おばけ|幽霊|ゆうれい', ko: '유령', th: 'ผี', vi: 'con ma|ma' },
  { en: 'cloud', 'zh-TW': '雲', 'zh-CN': '云', ja: '雲|くも', ko: '구름', th: 'เมฆ|ก้อนเมฆ', vi: 'đám mây|mây' },
  { en: 'eye', 'zh-TW': '眼睛', 'zh-CN': '眼睛', ja: '目|め', ko: '눈', th: 'ตา|ดวงตา', vi: 'con mắt|mắt' },
  { en: 'rabbit|bunny', 'zh-TW': '兔子', 'zh-CN': '兔子', ja: 'うさぎ|兎', ko: '토끼', th: 'กระต่าย', vi: 'con thỏ|thỏ' },
  { en: 'elephant', 'zh-TW': '大象', 'zh-CN': '大象', ja: '象|ぞう', ko: '코끼리', th: 'ช้าง', vi: 'con voi|voi' },
];

/** The word as shown in a language. */
export function wordIn(word: number, lang: Lang): string {
  return WORDS[word]?.[lang].split('|')[0] ?? '';
}

/**
 * The form a guess is compared in: width, case, katakana/hiragana, accents
 * and tone marks, spaces and punctuation don't matter.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

async function hash(salt: string, answer: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${normalize(answer)}`));
  return Array.from(new Uint8Array(bytes).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The hashes of every accepted answer to a word, in every language. */
export async function answerHashes(word: number, salt: string): Promise<string[]> {
  const answers = new Set(Object.values(WORDS[word]).flatMap((forms) => forms.split('|')).map(normalize));
  return Promise.all([...answers].map((a) => hash(salt, a)));
}

export async function isAnswer(guess: string, salt: string, hashes: string[]): Promise<boolean> {
  return normalize(guess) !== '' && hashes.includes(await hash(salt, guess));
}
