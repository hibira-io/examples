import type { Lang } from './i18n';

// Lines only the Phaser version has; everything else is nextjs-lobby's strings.ts.
export const EXTRA: Record<Lang, { tapHint: string; setup: string }> = {
  en: {
    tapHint: 'Tap the circle or press Space',
    setup: 'Set VITE_HIBIRA_APP_KEY in .env.local and start nextjs-lobby (see README).',
  },
  'zh-TW': {
    tapHint: '點圓圈或按空白鍵',
    setup: '請在 .env.local 設定 VITE_HIBIRA_APP_KEY，並啟動 nextjs-lobby（見 README）。',
  },
  'zh-CN': {
    tapHint: '点圆圈或按空格键',
    setup: '请在 .env.local 设置 VITE_HIBIRA_APP_KEY，并启动 nextjs-lobby（见 README）。',
  },
  ja: {
    tapHint: '円をタップするかスペースキー',
    setup: '.env.local に VITE_HIBIRA_APP_KEY を設定し、nextjs-lobby を起動してください（README 参照）。',
  },
  ko: {
    tapHint: '원을 탭하거나 스페이스 키',
    setup: '.env.local에 VITE_HIBIRA_APP_KEY를 설정하고 nextjs-lobby를 실행하세요(README 참고).',
  },
  th: {
    tapHint: 'แตะวงกลมหรือกด Space',
    setup: 'ตั้งค่า VITE_HIBIRA_APP_KEY ใน .env.local แล้วเปิด nextjs-lobby (ดู README)',
  },
  vi: {
    tapHint: 'Chạm vào vòng tròn hoặc nhấn Space',
    setup: 'Đặt VITE_HIBIRA_APP_KEY trong .env.local và chạy nextjs-lobby (xem README).',
  },
};
