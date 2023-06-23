import type { Miro } from '@mirohq/websdk-types'
import type { DependencyList } from 'react';
import React from 'react'
import invariant from 'tiny-invariant'
import { usePromiseState } from './use-promise-state'
import { useMiroJiggle } from './use-miro-jiggle'

type MiroContext = {
  jiggle: string
  boardId: null | string
}

const miroContext = React.createContext<null | MiroContext>(null)

export function MiroContextProvider({ children }: React.PropsWithChildren<{}>) {
  const [boardId, setBoardId] = React.useState<string | null>(null)

  React.useEffect(() => {
    console.log('getInfo')
    miro.board.getInfo().then((info) => {
      console.log('setBoardId', info)
      setBoardId(info.id)
    })
  }, [])

  const jiggle = useMiroJiggle()
  const value = React.useMemo((): MiroContext => {
    return {
      boardId,
      jiggle: jiggle + boardId,
    }
  }, [boardId, jiggle]);

  return (
    <miroContext.Provider value={value}>
      {children}
    </miroContext.Provider>
  )

}


export function useMiroContext() {
  const contextValue = React.useContext(miroContext)
  invariant(contextValue, 'useMiroContext must be used within a MiroContextProvider')

  return contextValue
}

export const useIsMiroConnected = () => useMiroContext().boardId !== null

type MiroQuery<T> = (miro: Miro) => Promise<T>
export function useMiroQuery<T>(
  query: MiroQuery<T>,
  deps: DependencyList
) {
  const isConnected = useIsMiroConnected()
  const jiggle = useMiroContext().jiggle

  return usePromiseState(async () => {
    console.log(jiggle, isConnected)
    if (jiggle && isConnected) {
      return query(miro)
    }
  }, deps.concat([jiggle]))
}

