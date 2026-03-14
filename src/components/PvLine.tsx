import React, { useState, useMemo } from "react";
import { Chess } from "chess.js";
import { useBoard } from "../contexts/BoardContext";

interface PvLineProps {
  startFen: string;
  sans: string[];
}

export default function PvLine({ startFen, sans }: PvLineProps) {
  const { showPreviewFen, clearPreview } = useBoard();
  const [revealed, setRevealed] = useState(1);
  const [step, setStep] = useState<number | null>(null);

  const fens = useMemo(() => {
    const result: string[] = [startFen];
    const game = new Chess(startFen);
    for (const san of sans) {
      try {
        game.move(san);
        result.push(game.fen());
      } catch {
        break;
      }
    }
    return result;
  }, [startFen, sans]);

  const moves = sans.slice(0, fens.length - 1);
  if (moves.length === 0) return null;

  const isActive = step !== null;
  const atEnd = revealed >= moves.length && step === moves.length - 1;

  function handleNext(e: React.MouseEvent) {
    e.stopPropagation();
    if (step === null) {
      setStep(0);
      showPreviewFen(fens[1]);
    } else if (step < revealed - 1) {
      const next = step + 1;
      setStep(next);
      showPreviewFen(fens[next + 1]);
    } else if (revealed < moves.length) {
      const next = step + 1;
      setRevealed(next + 1);
      setStep(next);
      showPreviewFen(fens[next + 1]);
    }
  }

  function handlePrev(e: React.MouseEvent) {
    e.stopPropagation();
    if (step === null || step === 0) {
      setStep(null);
      clearPreview();
    } else {
      const next = step - 1;
      setStep(next);
      showPreviewFen(fens[next + 1]);
    }
  }

  function handleGoTo(i: number, e: React.MouseEvent) {
    e.stopPropagation();
    setStep(i);
    showPreviewFen(fens[i + 1]);
  }

  const btnBase =
    "text-xs px-1.5 py-0.5 rounded transition-colors leading-none";
  const btnEnabled =
    "bg-surface-hi text-label hover:bg-interactive-hi";
  const btnDisabled =
    "text-muted cursor-not-allowed opacity-40";

  return (
    <div className="inline-flex flex-col gap-0.5 cursor-default">
      <span className="inline-flex items-center gap-0.5 flex-wrap">
        <span className="font-mono text-xs flex gap-0.5 flex-wrap">
          {moves.slice(0, revealed).map((san, i) => (
            <button
              key={i}
              onClick={(e) => handleGoTo(i, e)}
              className={`px-1 py-0.5 rounded transition-colors leading-none ${
                step === i
                  ? "bg-blue-500 text-white"
                  : "hover:bg-interactive-hi text-label"
              }`}
            >
              {san}
            </button>
          ))}
        </span>
      </span>
      <div className="flex gap-2 mt-1">
        <button
          onClick={handlePrev}
          disabled={!isActive}
          className={`${btnBase} ${!isActive ? btnDisabled : btnEnabled} px-2 py-1`}
        >
          &lt; prev
        </button>
        <button
          onClick={handleNext}
          disabled={atEnd}
          className={`${btnBase} ${atEnd ? btnDisabled : btnEnabled} px-2 py-1`}
        >
          next &gt;
        </button>
      </div>
    </div>
  );
}
