import type { DependencyList } from "react";
import React from "react";

export type PromiseState<T> =
  | { state: "running"; value?: never }
  | { state: "resolved"; value: T }
  | { state: "timeout"; value?: never };
export function usePromiseState<T>(
  factory: () => Promise<T>,
  deps: DependencyList
): PromiseState<T> {
  const [state, setState] = React.useState<PromiseState<T>>({
    state: "running",
  });

  React.useEffect(() => {
    async function runEffect() {
      try {
        const value = await Promise.race([
          factory(),
          new Promise<T>((resolve, reject) =>
            setTimeout(() => reject(new Error("timeout")), 10000)
          ),
        ]);
        setState({ state: "resolved", value });
      } catch (e) {
        console.error(e);
        setState({
          state: "timeout",
        });
      }
    }
    runEffect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
