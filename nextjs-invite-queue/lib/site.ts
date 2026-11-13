// The hosted copy is the one hibira.io serves at /tools/invite-queue/
// (DEMO_BASE_PATH); another base path is named on demos.hibira.io.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const SITE = BASE.startsWith('/tools/') ? `https://hibira.io${BASE}/` : BASE ? `https://demos.hibira.io${BASE}/` : undefined;
