import * as React from "react";

export function useIsMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = React.useState<boolean>(
    typeof window === "undefined" ? false : window.innerWidth < breakpoint
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}
