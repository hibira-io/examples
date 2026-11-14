export type Lang = 'en' | 'zh-TW' | 'ja';

export const STRINGS = {
  en: {
    title: 'API health',
    polling: 'Polling: every viewer queries Postgres once a second',
    push: 'Push: one query a second, sent to every viewer over Hibira',
    rps: 'Requests / s',
    errors: 'Error rate',
    p95: 'p95 latency',
    watching: 'Watching now',
    unknown: 'unknown',
    updated: (s: string) => `Updated ${s} s ago`,
    waiting: 'Waiting for data…',
    chart: 'Requests / s, last 60 updates',
  },
  'zh-TW': {
    title: 'API 健康狀態',
    polling: '輪詢：每位觀看者每秒查一次 Postgres',
    push: '推送：每秒只查一次，透過 Hibira 送給所有觀看者',
    rps: '每秒請求數',
    errors: '錯誤率',
    p95: 'p95 延遲',
    watching: '正在觀看',
    unknown: '不知道',
    updated: (s: string) => `${s} 秒前更新`,
    waiting: '等待資料中…',
    chart: '每秒請求數，最近 60 次更新',
  },
  ja: {
    title: 'API ヘルス',
    polling: 'ポーリング：閲覧者ごとに毎秒 Postgres へクエリ',
    push: 'プッシュ：クエリは毎秒1回、Hibira で全員に配信',
    rps: 'リクエスト / 秒',
    errors: 'エラー率',
    p95: 'p95 レイテンシ',
    watching: '閲覧中',
    unknown: '不明',
    updated: (s: string) => `${s} 秒前に更新`,
    waiting: 'データを待っています…',
    chart: 'リクエスト / 秒（直近 60 回の更新）',
  },
};

export function pickLang(value: string | undefined): Lang {
  return value === 'zh-TW' || value === 'ja' ? value : 'en';
}
