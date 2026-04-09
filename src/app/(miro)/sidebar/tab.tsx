"use client";
import classNames from "classnames";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tab({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div
      className={classNames("tab", {
        "tab-active": pathname === href,
      })}
    >
      <Link href={href} className="tab-text tab-badge">
        {children}
      </Link>
    </div>
  );
}
