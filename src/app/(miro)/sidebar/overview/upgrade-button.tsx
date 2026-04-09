"use client";

import { useForegroundMiro } from "@/utils/foreground-miro-handler";

export function UpgradeButton() {
  const foreground = useForegroundMiro();
  return (
    <button
      onClick={() => {
        foreground.openUpgradeModal();
      }}
      className="m-2 button button-primary"
    >
      Upgrade
    </button>
  );
}
