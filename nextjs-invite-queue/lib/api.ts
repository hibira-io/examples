import { API } from './demo';
import type { ErrorCode } from './strings';
import type { VendorErrorCode } from './vendor-strings';

// Calls the queue's API (this app's routes, or the demo backend's) with the
// person's session or a vendor's API key.

export class ApiError extends Error {
  constructor(public code: ErrorCode | VendorErrorCode) {
    super(code);
  }
}

export async function api<T>(path: string, token: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data.error as ErrorCode | VendorErrorCode) || 'network');
  return data as T;
}
