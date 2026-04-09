import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "AppExplorer",
  description: "Miro extension for exploring and documenting any codebase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/mirotone@^5/dist/styles.css"
      ></link>
      {children}
    </>
  );
}
