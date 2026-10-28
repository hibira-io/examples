import { configured, host, port, tls } from './hibira';
import type { Config } from './connect';

/** What the browser needs to connect, from .env.local; null until it is set up. */
export function localConfig(): Config | null {
  return configured() ? { appKey: process.env.NEXT_PUBLIC_HIBIRA_APP_KEY!, host, port, tls } : null;
}
