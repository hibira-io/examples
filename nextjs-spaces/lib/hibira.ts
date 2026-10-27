import Pusher from 'pusher';

export const host = process.env.NEXT_PUBLIC_HIBIRA_HOST || 'ws.hibira.io';
export const port = Number(process.env.NEXT_PUBLIC_HIBIRA_PORT || 443);
export const tls = (process.env.NEXT_PUBLIC_HIBIRA_SCHEME || 'https') === 'https';

export function configured(): boolean {
  return Boolean(process.env.HIBIRA_APP_ID && process.env.HIBIRA_APP_SECRET && process.env.NEXT_PUBLIC_HIBIRA_APP_KEY);
}

let client: Pusher | undefined;

/** The server-side client. It signs API calls with the app secret, so it never runs in the browser. */
export function hibira(): Pusher {
  client ??= new Pusher({
    appId: process.env.HIBIRA_APP_ID!,
    key: process.env.NEXT_PUBLIC_HIBIRA_APP_KEY!,
    secret: process.env.HIBIRA_APP_SECRET!,
    host,
    port: String(port),
    useTLS: tls,
  });
  return client;
}
