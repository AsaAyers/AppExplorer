"use client";
import React from "react";

export function useLocalStorage<T>(key: string, defaultValue: () => T) {
  const [state, setState] = React.useState<T>(() => {
    try {
      const rawValue = localStorage.getItem(key);

      if (rawValue) {
        return JSON.parse(rawValue);
      }
    } catch {
      // ignore
    }
    const v = defaultValue();
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      // ignore
    }
    return v;
  });
  return [state, setState] as const;
}
