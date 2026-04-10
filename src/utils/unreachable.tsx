"use client";

export function unreachable(x: never): never {
  throw new Error(`Unreachable code reached with value: ${JSON.stringify(x)}`);
}
