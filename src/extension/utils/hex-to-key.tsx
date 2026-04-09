"use client";
import invariant from "tiny-invariant";

export function hexToKey(key: string) {
  const hexValues = key.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16));
  invariant(hexValues, "Unable to parse hex values");
  return new Uint8Array(hexValues);
}
