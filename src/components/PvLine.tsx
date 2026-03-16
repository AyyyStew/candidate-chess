import React, { useState, useMemo, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import { useBoard } from "../contexts/BoardContext";
import { playMoveSound } from "../utils/sounds";

interface PvLineProps {
  startFen: string;
  sans: string[];
  /** Render as a single-row carousel inside a flex container. */
  inline?: boolean;
  /** Disable navigation (arrows hidden, first move shown as static). */
  locked?: boolean;
}

export default function PvLine({ startFen, sans, inline = false, locked = false }: PvLineProps) {
  const { showPreviewFen, clearPreview } = useBoard();
  const [step, setStep] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(1);

  const fens = useMemo(() => {
    const result: string[] = [startFen];
    const game = new Chess(startFen);
    for (const s of sans) {
      try { game.move(s); result.push(game.fen()); }
      catch { break; }
    }
    return result;
  }, [startFen, sans]);

  const moves = sans.slice(0, fens.length - 1);
  if (moves.length === 0) return null;

  // ── Inline incrementer mode ───────────────────────────────────────────────
  const contRef = useRef<HTMLDivElement>(null);
  const [contWidth, setContWidth] = useState(0);

  useEffect(() => {
    if (!inline) return;
    const el = contRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [inline]);

  if (inline) {
    const atStart = step === null;
    // atEnd only true when we've actually reached the last move (not when step is null)
    const atEnd = step !== null && step >= moves.length - 1;

    // Single navigation function. Uses functional setRevealed to avoid stale closures.
    function goTo(newStep: number | null) {
      if (newStep === null) {
        setStep(null);
        clearPreview();
      } else {
        setStep(newStep);
        setRevealed(prev => Math.max(prev, newStep + 1));
        showPreviewFen(fens[newStep + 1]);
        playMoveSound();
      }
    }

    const navBtn = (disabled: boolean) =>
      `text-xs leading-none px-1 py-0.5 rounded shrink-0 transition-colors font-mono ${
        disabled
          ? "text-muted/25 cursor-default"
          : "text-muted hover:text-label hover:bg-interactive-hi"
      }`;

    return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {/* First move — always visible, prominent */}
        <button
          onClick={(e) => { e.stopPropagation(); if (!locked) goTo(0); }}
          disabled={locked}
          className={`font-semibold text-sm shrink-0 px-1.5 py-0.5 rounded transition-colors ${
            locked
              ? "text-text cursor-default"
              : step === 0
              ? "bg-blue-500 text-white"
              : "text-text hover:bg-interactive-hi"
          }`}
        >
          {moves[0]}
        </button>

        {/* Controls + continuation (only when unlocked) */}
        {!locked && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(null); }}
              disabled={atStart}
              className={navBtn(atStart)}
            >|‹</button>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(step === null || step === 0 ? null : step - 1); }}
              disabled={atStart}
              className={navBtn(atStart)}
            >‹</button>

            {/* Windowed continuation moves with ellipsis */}
            {(() => {
              // ~40px per button (font-mono text-xs + px-1.5 padding + gap), 20px for ellipsis
              const WINDOW = Math.max(1, Math.floor((contWidth - 20) / 40));
              const contMoves = moves.slice(1, revealed);

              // Slide window to always include the active step
              let winStart = Math.max(0, contMoves.length - WINDOW);
              if (step !== null && step > 0) {
                const activeContIdx = step - 1;
                if (activeContIdx < winStart) winStart = activeContIdx;
                if (activeContIdx >= winStart + WINDOW) winStart = activeContIdx - WINDOW + 1;
              }

              const visible = contMoves.slice(winStart, winStart + WINDOW);
              const showEllipsis = winStart > 0;

              return (
                <div ref={contRef} className="flex gap-0.5 items-center flex-1">
                  {showEllipsis && (
                    <span className="text-xs font-mono text-muted/40 shrink-0 px-0.5">…</span>
                  )}
                  {visible.map((s, i) => {
                    const idx = winStart + i + 1;
                    return (
                      <button
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); goTo(idx); }}
                        className={`px-1.5 py-0.5 rounded text-xs font-mono leading-none shrink-0 transition-colors ${
                          step === idx
                            ? "bg-blue-500 text-white"
                            : "text-label/60 hover:bg-interactive-hi hover:text-label"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            <button
              onClick={(e) => { e.stopPropagation(); if (!atEnd) goTo(step === null ? 0 : step + 1); }}
              disabled={atEnd}
              className={navBtn(atEnd)}
            >›</button>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(moves.length - 1); }}
              disabled={atEnd}
              className={navBtn(atEnd)}
            >›|</button>
          </>
        )}
      </div>
    );
  }

  // ── Original vertical mode ─────────────────────────────────────────────────
  const isActive = step !== null;
  const atEnd = revealed >= moves.length && step === moves.length - 1;

  function handleNext(e: React.MouseEvent) {
    e.stopPropagation();
    if (step === null) {
      setStep(0); showPreviewFen(fens[1]); playMoveSound();
    } else if (step < revealed - 1) {
      const next = step + 1; setStep(next); showPreviewFen(fens[next + 1]); playMoveSound();
    } else if (revealed < moves.length) {
      const next = step + 1; setRevealed(next + 1); setStep(next); showPreviewFen(fens[next + 1]); playMoveSound();
    }
  }

  function handlePrev(e: React.MouseEvent) {
    e.stopPropagation();
    if (step === null || step === 0) { setStep(null); clearPreview(); }
    else { const next = step - 1; setStep(next); showPreviewFen(fens[next + 1]); playMoveSound(); }
  }

  function handleGoTo(i: number, e: React.MouseEvent) {
    e.stopPropagation();
    setStep(i); showPreviewFen(fens[i + 1]); playMoveSound();
  }

  const btnBase = "text-xs px-1.5 py-0.5 rounded transition-colors leading-none";
  const btnEnabled = "bg-surface-hi text-label hover:bg-interactive-hi";
  const btnDisabled = "text-muted cursor-not-allowed opacity-40";

  return (
    <div className="inline-flex flex-col gap-0.5 cursor-default">
      <span className="font-mono text-xs flex gap-0.5 flex-wrap">
        {moves.slice(0, revealed).map((san, i) => (
          <button
            key={i}
            onClick={(e) => handleGoTo(i, e)}
            className={`px-1 py-0.5 rounded transition-colors leading-none ${
              step === i ? "bg-blue-500 text-white" : "hover:bg-interactive-hi text-label"
            }`}
          >
            {san}
          </button>
        ))}
      </span>
      <div className="flex gap-2 mt-1">
        <button onClick={handlePrev} disabled={!isActive} className={`${btnBase} ${!isActive ? btnDisabled : btnEnabled} px-2 py-1`}>
          &lt; prev
        </button>
        <button onClick={handleNext} disabled={atEnd} className={`${btnBase} ${atEnd ? btnDisabled : btnEnabled} px-2 py-1`}>
          next &gt;
        </button>
      </div>
    </div>
  );
}
