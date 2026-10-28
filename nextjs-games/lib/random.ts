/** A random whole number from 0 to n - 1, from the browser's secure generator. */
export function randomInt(n: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % n;
}
