import { useEffect } from "react";

const useDebouncedEffect = (
  callback: () => any,
  dependencies: unknown[] = [],
  delay = 500
) => {
  useEffect(() => {
    let cleanup: VoidFunction | null = null;
    const handler = setTimeout(() => {
      cleanup = callback();
    }, delay);

    return () => {
      clearTimeout(handler);
      typeof cleanup === "function" && cleanup();
    };
  }, dependencies);
};

export default useDebouncedEffect;
