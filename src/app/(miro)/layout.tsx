/* eslint-disable @next/next/no-css-tags */
import type { Metadata } from "next";
import Script from "next/script";

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
      <link rel="stylesheet" href="/index.css" />
      <Script
        src="https://miro.com/app/static/sdk/v2/miro.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
