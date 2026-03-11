// Mock data for now — swap getDailyPosition() body for a fetch() call when ready.
// Each entry represents a middlegame position from a master game.

const DAILY_POSITIONS = [
  {
    id: 1,
    fen: "r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 9",
    label: "Kasparov vs Karpov",
    event: "World Championship 1985",
    moveNumber: 9,
    orientation: "white",
  },
  {
    id: 2,
    fen: "r2qr1k1/1b2bppp/p2p1n2/1p2p3/3NP3/PBN1B3/1PP2PPP/R2QR1K1 w - - 0 14",
    label: "Fischer vs Spassky",
    event: "World Championship 1972, Game 6",
    moveNumber: 14,
    orientation: "white",
  },
  {
    id: 3,
    fen: "r1b2rk1/pp2qppp/2n1pn2/3p4/1bPP4/2NBP1N1/PP3PPP/R1BQK2R w KQ - 0 10",
    label: "Anand vs Kramnik",
    event: "World Championship 2008",
    moveNumber: 10,
    orientation: "white",
  },
  {
    id: 4,
    fen: "r3r1k1/pp1b1ppp/1qn1pn2/3p4/2PP4/2N1PN2/PPQ2PPP/R1BR2K1 b - - 0 13",
    label: "Carlsen vs Nakamura",
    event: "Tata Steel 2013",
    moveNumber: 13,
    orientation: "black",
  },
  {
    id: 5,
    fen: "r1bqr1k1/1pp2ppp/p1np1n2/4p3/2PPP3/2N2N2/PP2BPPP/R1BQR1K1 b - - 0 11",
    label: "Tal vs Botvinnik",
    event: "World Championship 1960",
    moveNumber: 11,
    orientation: "black",
  },
];

/**
 * Returns today's position based on date.
 * Deterministic — same date always returns the same position.
 * Replace this function body with a fetch() call when connecting to an API/DB.
 */
export function getDailyPosition() {
  const today = new Date();
  const dayIndex =
    Math.floor(today.getTime() / (1000 * 60 * 60 * 24)) %
    DAILY_POSITIONS.length;
  return DAILY_POSITIONS[dayIndex];
}
