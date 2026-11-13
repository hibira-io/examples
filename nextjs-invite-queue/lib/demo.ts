// The hosted demo on GitHub Pages (.github/workflows/pages.yml) is a static
// export with no API routes: its builds set NEXT_PUBLIC_DEMO_API, and the
// browser calls Hibira's demo backend there instead of this app's routes.

export const DEMO_API = process.env.NEXT_PUBLIC_DEMO_API ?? '';

export const SOURCE_URL = 'https://github.com/hibira-io/examples/tree/main/nextjs-invite-queue';

export const HIBIRA_URL = 'https://hibira.io/?utm_source=demos&utm_medium=tool&utm_campaign=invite-queue';

export const SIGNUP_URL = 'https://hibira.io/portal?utm_source=demos&utm_medium=tool&utm_campaign=invite-queue';

/** Base URL of the queue's API: this app's routes, or the demo backend's. */
export const API = DEMO_API ? `${DEMO_API}/invite-queue` : '/api/queue';

/** Where pusher-js asks to join the person's private channel. */
export const AUTH_URL = DEMO_API ? `${DEMO_API}/invite-queue/pusher/auth` : '/api/pusher/auth';
