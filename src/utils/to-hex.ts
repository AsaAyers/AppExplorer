import invariant from "tiny-invariant";

export const toHex = (key: Uint8Array) =>
  Array.from(key)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export function fromHex(hex: string) {
  invariant(
    hex.length === 128,
    `Hex string must be 128 characters (64 bytes) ${hex}`,
  );

  const hexValues = hex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16));

  invariant(hexValues, "Invalid hex string");

  return new Uint8Array(hexValues);
}

export function randomHex(bits: number) {
  invariant(bits % 8 === 0, "Bits must be a multiple of 8");
  const bytes = new Uint8Array(bits / 8);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}
