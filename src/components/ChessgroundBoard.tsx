import { useEffect, useRef } from "react";
import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";

interface Props {
  config: Config;
  apiRef?: React.MutableRefObject<Api | null>;
}

export default function ChessgroundBoard({ config, apiRef }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<Api | null>(null);

  useEffect(() => {
    if (!elRef.current) return;
    const el = elRef.current;

    const suppressContext = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("contextmenu", suppressContext);
    const api = Chessground(el, config);
    internalRef.current = api;
    if (apiRef) apiRef.current = api;
    return () => {
      el.removeEventListener("contextmenu", suppressContext);
      api.destroy();
      internalRef.current = null;
      if (apiRef) apiRef.current = null;
    };
  }, []);

  // Sync config on every render — chessground diffs internally so this is cheap
  useEffect(() => {
    internalRef.current?.set(config);
  });

  return <div ref={elRef} className="cg-wrap" />;
}
