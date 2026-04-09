"use client";
import React from "react";
import invariant from "tiny-invariant";

import { ClientSession } from "@/components/client-session-action";

const clientSessionContext = React.createContext<ClientSession | null>(null);

export const useClientSession = () => {
  const value = React.use(clientSessionContext);
  invariant(value, "Missing ClientSessionProvider");

  return value;
};

export function ClientSessionProvider({
  children,
  data,
}: {
  children: React.ReactNode;
  data: ClientSession;
}) {
  return (
    <clientSessionContext.Provider value={data}>
      {children}
    </clientSessionContext.Provider>
  );
}
