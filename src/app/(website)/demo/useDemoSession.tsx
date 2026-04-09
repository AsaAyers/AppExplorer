"use client";
import { randomHex } from "@/utils/to-hex";
import { useLocalStorage } from "@/utils/use-local-storage";

export function useDemoSession() {
  return useLocalStorage<{
    sessionId: string;
    sessionHexKey: string;
  }>("demo-session", () => ({
    sessionId: randomHex(128),
    sessionHexKey: randomHex(512),
  }));
}
