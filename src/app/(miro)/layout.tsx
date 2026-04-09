import "@/app/globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import React from "react";

import { ClientSessionProvider } from "@/components/client-session";
import { getClientSessionAction } from "@/components/client-session-action";
import { ProvideChannelContext } from "@/lib/broadcast-channel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AppExplorer",
  description: "Miro extension for exploring and documenting any codebase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const data = React.use(getClientSessionAction());

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/mirotone@^5/dist/styles.css"
      ></link>
      <Script
        src="https://miro.com/app/static/sdk/v2/miro.js"
        strategy="beforeInteractive"
      />
      <ClientSessionProvider data={data}>
        <ProvideChannelContext>{children}</ProvideChannelContext>
      </ClientSessionProvider>
    </>
  );
}
