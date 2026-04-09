"use client";
export function decode(str: string) {
  return str.replaceAll(/&#([0-9A-F]{2});/g, (_, charCode) =>
    String.fromCharCode(parseInt(charCode)),
  );
}
