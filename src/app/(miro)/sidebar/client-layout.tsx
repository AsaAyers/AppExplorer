"use client";

import classNames from "classnames";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

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
        "tab-active": pathname.startsWith(href),
      })}
    >
      <Link href={href} className="tab-text tab-badge">
        {children}
      </Link>
    </div>
  );
}

export default function SidebarClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div layoutScroll className="grid overflow-y-scroll max-h-screen">
      <div className="cs1 ce12  sticky z-10 top-0 bg-white">
        <div className="tabs cs1 ce12  sticky z-10 top-0 m-2 pb-2">
          <div className="tabs-header-list">
            <Tab href="/sidebar/overview">Overview</Tab>
            <Tab href="/sidebar/create">Create Cards</Tab>
            <Tab href="/sidebar/list">List Cards</Tab>
          </div>
        </div>
      </div>
      {children}
    </motion.div>
  );
}
