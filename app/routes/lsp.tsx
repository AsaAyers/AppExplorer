import { Outlet } from "@remix-run/react";
import { MiroContextProvider } from "~/lsp/components/miro-context";

export default function () {
  return (
    <MiroContextProvider>
      <Outlet />
    </MiroContextProvider>
  )
}