"use client";
import classNames from "classnames";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { demoTextFiles } from "@/app/(website)/demo/demo-text-files";

export function Tab({
  path,
  children,
  isActive,
}: {
  path: string;
  children: React.ReactNode;
  isActive: boolean;
}) {
  return (
    <div
      className={classNames("tab", {
        "tab-active": isActive,
      })}
    >
      <Link
        href={{
          search: `?path=${path}`,
        }}
        className="tab-text tab-badge"
      >
        {children}
      </Link>
    </div>
  );
}
export function FileTabs() {
  const searchParams = useSearchParams();
  const path = searchParams.get("path") ?? demoTextFiles[0].path;

  return (
    <motion.div layoutScroll className="grid overflow-y-scroll max-h-screen">
      <div className="cs1 ce12  sticky z-10 top-0 bg-white">
        <div className="tabs cs1 ce12  sticky z-10 top-0 pb-2">
          <div className="tabs-header-list">
            {demoTextFiles.map((file) => (
              <Tab
                key={file.path}
                path={file.path}
                isActive={path === file.path}
              >
                {file.path.split("/").pop()}
              </Tab>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
