"use client";
export function decode(str: string) {
  return str.replaceAll(/&#(\d+);/g, (_, charCode) =>
    String.fromCharCode(parseInt(charCode, 10)),
  );
}
