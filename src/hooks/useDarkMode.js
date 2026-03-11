import { useState, useEffect } from "react";

export function useDarkMode() {
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return { dark, toggleDark: () => setDark((d) => !d) };
}
