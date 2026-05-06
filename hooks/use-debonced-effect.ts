import { useEffect, useRef } from "react";

type EffectCallback = () => void | (() => void);

const useDebouncedEffect = (
  callback: EffectCallback,
  dependencies: unknown[],
  delay = 500
) => {
  const callbackRef = useRef(callback);

  callbackRef.current = callback;

  useEffect(() => {
    const handler = setTimeout(() => {
      const cleanup = callbackRef.current();

      if (typeof cleanup === "function") {
        cleanup();
      }
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [...dependencies, delay]);
};

export default useDebouncedEffect;
