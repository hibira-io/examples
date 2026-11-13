// The hosted copy is the one hibira.io serves at /tools/invite-queue/
// (DEMO_BASE_PATH); another base path is named on demos.hibira.io.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const SITE = BASE.startsWith('/tools/') ? `https://hibira.io${BASE}/` : BASE ? `https://demos.hibira.io${BASE}/` : undefined;

// On hibira.io the page in each language other than English sits under the
// site's language prefix, like the rest of the site: /ja/tools/invite-queue/
// (the demo-api Worker maps it to this build's /ja/ page). On
// demos.hibira.io it is the build's own path, …/invite-queue/ja/.
export const LOCALE_PREFIX = BASE.startsWith('/tools/');

/** The first page's address in a language, given its path slug ('' for English). */
export function pageUrl(slug: string): string | undefined {
  if (!SITE) return undefined;
  if (!slug) return SITE;
  return LOCALE_PREFIX ? `https://hibira.io/${slug}${BASE}/` : `${SITE}${slug}/`;
}
