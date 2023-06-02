import { Outlet } from "@remix-run/react";
import React from "react";



export default function () {
  React.useEffect(() => {
    miro.board.ui.on('selection:update', async (event) => {
      if (event.items.length === 1) {
        const item = event.items[0]
        const data = await item.getMetadata()
        if (data.projectName && data.path) {
          const url = `/lsp/${data.projectName}/plugin/AppExplorer/view-file/?path=${data.path}`
          await miro.board.ui.openPanel({ url });
        }
      }
    })
  })

  return (
    <Outlet />
  )
}
