// The hosted demo on GitHub Pages (.github/workflows/pages.yml) is a static
// export with no API routes: its builds set NEXT_PUBLIC_DEMO_API, and the
// browser calls Hibira's demo backend there instead of this app's routes.

export const DEMO_API = process.env.NEXT_PUBLIC_DEMO_API ?? '';

export const SOURCE_URL = 'https://github.com/hibira-io/examples/tree/main/nextjs-games';

export const HIBIRA_URL = 'https://hibira.io/?utm_source=github&utm_medium=demo&utm_campaign=examples&utm_content=nextjs-games';

/** This app's own route, or the demo backend's when built as a hosted demo. */
export function endpoint(local: string, demo: string): string {
  return DEMO_API ? DEMO_API + demo : local;
}
