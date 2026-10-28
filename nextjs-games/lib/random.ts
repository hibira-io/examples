/** A random whole number from 0 to n - 1 (n up to 2^32), unbiased, from the browser's secure generator. */
export function randomInt(n: number): number {
  // Draws past the last whole multiple of n are thrown away, so every value is equally likely.
  const limit = 2 ** 32 - (2 ** 32 % n);
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}
