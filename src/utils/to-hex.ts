export const toHex = (key: Uint8Array) =>
  Array.from(key)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export function randomHex(bits: number) {
  const bytes = new Uint8Array(bits / 8);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * Usage: tsx to-hex.ts <bits>
 * Example: tsx to-hex.ts 256
 *
 */
function main() {
  const bits = parseInt(process.argv[2], 10);
  if (isNaN(bits) || bits % 8 !== 0) {
    console.error("Please provide a valid number of bits (multiple of 8)");
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(randomHex(bits));
}

if (import.meta.url === process.argv[1]) {
  main();
}
