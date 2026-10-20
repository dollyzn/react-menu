import { useEffect, useRef } from "react";

type EffectCallback = () => void | (() => void);

const useDebouncedEffect = (
  callback: EffectCallback,
  dependencies: unknown[],
  delay = 500
) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    let cleanup: void | (() => void);

    const handler = setTimeout(() => {
      cleanup = callbackRef.current();
    }, delay);

    return () => {
      clearTimeout(handler);
      if (typeof cleanup === "function") cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are forwarded from the caller
  }, [...dependencies, delay]);
};

export default useDebouncedEffect;
