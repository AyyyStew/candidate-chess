import { useEffect, useState } from "react";

const BREAKPOINT = "(max-width: 1023px)";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(BREAKPOINT).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(BREAKPOINT);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
