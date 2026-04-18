import type { Metadata } from "next";
import Script from "next/script";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "AppExplorer",
  description: "AppExplorer Miro routes",
};

export default function MiroLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Script
        src="https://miro.com/app/static/sdk/v2/miro.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
