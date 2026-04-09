import type { Metadata, Viewport } from "next";

import appExplorerLogo from "@/assets/logo/app-explorer.svg";

export const metadata: Metadata = {
  title: {
    template: "%s | AppExplorer",
    default: "",
  },
  description: "Miro extension for exploring and documenting any codebase",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={appExplorerLogo.src} type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
