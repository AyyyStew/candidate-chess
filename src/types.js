// src/types.js

/**
 * A chess move category (quality label from engine comparison)
 * @typedef {Object} Category
 * @property {string} label - e.g. "Best", "Excellent", "Blunder"
 * @property {string} icon  - e.g. "★", "✦", "??"
 * @property {string} color - CSS color string e.g. "#22c55e"
 */

/**
 * A single move in a principal variation line
 * @typedef {Object} PVLine
 * @property {string[]} moves - UCI move strings e.g. ["e2e4", "e7e5", "g1f3"]
 * @property {string[]} sans  - SAN move strings e.g. ["e4", "e5", "Nf3"]
 */

/**
 * A top engine move with full evaluation data
 * @typedef {Object} TopMove
 * @property {string}   move     - UCI string e.g. "e2e4"
 * @property {string}   san      - SAN string e.g. "e4"
 * @property {number}   rawEval  - White-perspective centipawn eval e.g. 0.32
 * @property {number}   eval     - Same as rawEval, display-ready
 * @property {number}   diffBest - Eval delta vs best move (always <= 0)
 * @property {number}   diffPos  - Eval delta vs position eval
 * @property {Category} category - Move quality label
 * @property {PVLine}   line     - Full engine continuation
 */

/**
 * A candidate move submitted by the user
 * @typedef {Object} Candidate
 * @property {string}    move     - UCI string
 * @property {string}    san      - SAN string
 * @property {boolean}   pending  - True while engine is evaluating
 * @property {number}    [eval]   - Eval score, set after evaluation
 * @property {number}    [diffBest]
 * @property {number}    [diffPos]
 * @property {number}    [rank]   - Rank in engine top moves, null if not in list
 * @property {Category}  [category]
 * @property {boolean}   [isHit]  - Game mode: move was in top N
 * @property {boolean}   [isMiss] - Game mode: move was not in top N
 */

/**
 * The full result of an analysis session
 * @typedef {Object} AnalysisResult
 * @property {string}     fen          - The analyzed position
 * @property {number}     positionEval - White-perspective eval before any move
 * @property {number}     bestEval     - Eval of the best move
 * @property {TopMove[]}  topMoves     - Engine's top N moves, sorted best first
 * @property {Candidate[]} candidates  - User's evaluated candidate moves
 */

/**
 * A chess position from the position bank
 * @typedef {Object} Position
 * @property {number}          id          - Unique identifier
 * @property {string}          fen         - FEN string
 * @property {string}          label       - Display name e.g. "Kasparov vs Karpov"
 * @property {string}          event       - Tournament/event name
 * @property {number}          moveNumber  - Move number in the game
 * @property {'white'|'black'} orientation - Which side to show at bottom
 * @property {string}          [pgn]       - Full PGN string if available
 * @property {string[]}        [moves]     - Parsed move list leading to FEN
 */

/**
 * Snapshot pushed by a session to React via onChange
 * @typedef {Object} GameSnapshot
 * @property {'active'|'done'}  phase
 * @property {string}           fen
 * @property {'white'|'black'}  orientation
 * @property {string}           label
 * @property {string}           event
 * @property {number}           moveNumber
 * @property {Candidate[]}      candidates
 * @property {number}           strikes
 * @property {number}           maxStrikes
 * @property {number}           targetMoves
 * @property {TopMove[]}        liveTopMoves  - Populated once engine is ready
 * @property {boolean}          analysisReady
 */

/**
 * Snapshot pushed by StudySession to React via onChange
 * @typedef {Object} StudySnapshot
 * @property {'idle'|'active'|'comparing'|'done'} phase
 * @property {string|null}      lockedFen
 * @property {Candidate[]}      candidates
 * @property {AnalysisResult|null} results
 * @property {boolean}          analysisReady
 * @property {number}           minCandidates
 * @property {boolean}          canCompare
 */

// ---------------------------------------------------------------------------
// Factory functions — create valid objects with defaults, throw on bad input
// ---------------------------------------------------------------------------

/**
 * @param {Partial<TopMove>} data
 * @returns {TopMove}
 */
export function makeTopMove(data) {
  if (!data.move) throw new Error("TopMove requires move (UCI)");
  if (!data.san) throw new Error("TopMove requires san");
  const rawEval = data.rawEval ?? 0;
  const bestEval = data.bestEval ?? rawEval;
  return {
    move: data.move,
    san: data.san,
    rawEval,
    eval: rawEval,
    diffBest: data.diffBest ?? rawEval - bestEval,
    diffPos: data.diffPos ?? 0,
    category: data.category ?? null,
    line: data.line ?? { moves: [], sans: [] },
  };
}

/**
 * @param {Partial<Candidate>} data
 * @returns {Candidate}
 */
export function makeCandidate(data) {
  if (!data.move) throw new Error("Candidate requires move (UCI)");
  if (!data.san) throw new Error("Candidate requires san");
  return {
    move: data.move,
    san: data.san,
    pending: data.pending ?? false,
    eval: data.eval ?? undefined,
    diffBest: data.diffBest ?? undefined,
    diffPos: data.diffPos ?? undefined,
    rank: data.rank ?? null,
    category: data.category ?? null,
    isHit: data.isHit ?? undefined,
    isMiss: data.isMiss ?? undefined,
  };
}

/**
 * @param {Partial<AnalysisResult>} data
 * @returns {AnalysisResult}
 */
export function makeAnalysisResult(data) {
  if (!data.fen) throw new Error("AnalysisResult requires fen");
  return {
    fen: data.fen,
    positionEval: data.positionEval ?? 0,
    bestEval: data.bestEval ?? 0,
    topMoves: data.topMoves ?? [],
    candidates: data.candidates ?? [],
  };
}

/**
 * @param {Partial<Position>} data
 * @returns {Position}
 */
export function makePosition(data) {
  if (!data.fen) throw new Error("Position requires fen");
  if (!data.label) throw new Error("Position requires label");
  return {
    id: data.id ?? 0,
    fen: data.fen,
    label: data.label,
    event: data.event ?? "",
    moveNumber: data.moveNumber ?? 1,
    orientation: data.orientation ?? "white",
    pgn: data.pgn ?? null,
    moves: data.moves ?? [],
  };
}
