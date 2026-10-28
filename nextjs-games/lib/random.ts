/** A random whole number from 0 to n - 1 (n up to 2^31), unbiased, from the browser's secure generator. */
export function randomInt(n: number): number {
  // Keep just enough low bits to cover n, and draw again when the value is n or more.
  let mask = 1;
  while (mask < n) mask *= 2;
  mask -= 1;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const v = buf[0] & mask;
    if (v < n) return v;
  }
}
