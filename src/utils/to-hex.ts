export const toHex = (key: Uint8Array) =>
  Array.from(key)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export function randomHex(bits: number) {
  const bytes = new Uint8Array(bits / 8);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}
