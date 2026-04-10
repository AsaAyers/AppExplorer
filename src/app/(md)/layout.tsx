import Image from "next/image";
import Link from "next/link";

import "@/app/(md)/markdown.css";
import appExplorerLogo from "@/assets/app-explorer.svg";

// import "https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown.min.css";

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown.min.css"
      />
      <div className="md-background">
        <main>
          <Link
            href="/"
            className="m-2 col-span-6 lg:col-span-6 whitespace-pre "
          >
            <Image
              width="24"
              height="24"
              className="inline-block pgap-2 mr-2"
              src={appExplorerLogo}
              alt="AppExplorer Logo"
            />
            AppExplorer
          </Link>
          {children}
        </main>
      </div>
    </>
  );
}
