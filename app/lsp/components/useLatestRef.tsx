import React from "react";

// https://epicreact.dev/the-latest-ref-pattern-in-react/

if (typeof window === "undefined") React.useLayoutEffect = () => {};

export function useLatestRef<T>(value: T): React.MutableRefObject<T> {
  const ref = React.useRef(value);
  React.useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
