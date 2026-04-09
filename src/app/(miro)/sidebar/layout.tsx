"use client";

import React from "react";

import SidebarClientLayout from "@/app/(miro)/sidebar/client-layout";

export default function SidebarLayout({ children }: React.PropsWithChildren) {
  return <SidebarClientLayout>{children}</SidebarClientLayout>;
}
