import { Chess } from "chess.js";
import { makeCandidate, makeAnalysisResult } from "../types";
import type { Candidate, GameSnapshot, AnalysisResult } from "../types";
import type { EngineAnalysis } from "../engine/engineAnalysis";
import type { Position } from "../types";

const MAX_STRIKES = 3;

interface GameSessionOptions {
  analysis: EngineAnalysis;
  position: Position;
  targetMoves?: number;
}

export interface GameSession {
  getSnapshot: () => GameSnapshot;
  getResults: () => AnalysisResult;
  submitMove: (sourceSquare: string, targetSquare: string) => Promise<void>;
  onChange: ((snap: GameSnapshot) => void) | null;
}

export function createGameSession({
  analysis,
  position,
  targetMoves: initialTargetMoves = 5,
}: GameSessionOptions): GameSession {
  let phase: "active" | "done" = "active";
  let candidates: Candidate[] = [];
  let strikes = 0;
  let hits = 0;
  let targetMoves = initialTargetMoves;
  let onChange: ((snap: GameSnapshot) => void) | null = null;
  let analysisReady = analysis.isReady();
  let moveQueue: { uci: string; san: string }[] = [];
  let processingQueue = false;

  function buildSnapshot(): GameSnapshot {
    return {
      phase,
      fen: position.fen,
      orientation: position.orientation,
      label: position.label,
      event: position.event,
      moveNumber: position.moveNumber,
      pgn: position.pgn,
      candidates: [...candidates],
      strikes,
      maxStrikes: MAX_STRIKES,
      targetMoves,
      liveTopMoves: analysisReady ? analysis.getTopMoves() : [],
      analysisReady,
    };
  }

  let cachedSnapshot: GameSnapshot = buildSnapshot();

  function getSnapshot(): GameSnapshot {
    return cachedSnapshot;
  }

  function notify(): void {
    cachedSnapshot = buildSnapshot();
    onChange?.(cachedSnapshot);
  }

  analysis.waitForAnalysis().then(() => {
    analysisReady = true;
    const topCount = analysis.getTopMoves().length;
    if (topCount > 0 && topCount < targetMoves) {
      targetMoves = topCount;
    }
    notify();
    flushQueue();
  });

  async function flushQueue(): Promise<void> {
    if (processingQueue) return;
    processingQueue = true;
    while (moveQueue.length > 0) {
      const { uci, san } = moveQueue.shift()!;
      await processMove(uci, san);
    }
    processingQueue = false;
  }

  async function processMove(uci: string, san: string): Promise<void> {
    if (strikes >= MAX_STRIKES || hits >= targetMoves) return;

    const evaluated = await analysis.evaluateMove(uci, san);
    const isHit = evaluated.rank !== null && evaluated.rank <= targetMoves;

    if (isHit) hits++;
    else strikes++;

    candidates = candidates.map((c) =>
      c.move === uci
        ? {
            move: evaluated.move,
            san: evaluated.san,
            status: isHit ? "hit" : "miss",
            eval: evaluated.eval,
            category: evaluated.category,
            line: evaluated.line,
          }
        : c,
    );

    const gameOver = strikes >= MAX_STRIKES || hits >= targetMoves;
    if (gameOver) phase = "done";
    notify();
  }

  async function submitMove(
    sourceSquare: string,
    targetSquare: string,
  ): Promise<void> {
    if (strikes >= MAX_STRIKES || hits >= targetMoves) return;

    const game = new Chess(position.fen);
    let move;
    try {
      move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
    } catch {
      return;
    }
    if (!move) return;

    const uci = `${sourceSquare}${targetSquare}`;
    const alreadyQueued = moveQueue.some((m) => m.uci === uci);
    if (candidates.some((c) => c.move === uci) || alreadyQueued) return;

    candidates = [
      ...candidates,
      makeCandidate({ move: uci, san: move.san, status: "pending" }),
    ];
    notify();

    if (!analysisReady) {
      moveQueue.push({ uci, san: move.san });
      return;
    }

    await processMove(uci, move.san);
  }

  function getResults(): AnalysisResult {
    const topMoves = analysis.getTopMoves();
    return makeAnalysisResult({
      fen: position.fen,
      positionEval: analysis.getPositionEval(),
      bestEval: topMoves[0]?.rawEval ?? 0,
      topMoves,
      candidates: [...candidates],
    });
  }

  return {
    getSnapshot,
    getResults,
    submitMove,
    set onChange(cb: ((snap: GameSnapshot) => void) | null) {
      onChange = cb;
    },
  };
}
