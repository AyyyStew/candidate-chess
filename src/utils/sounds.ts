const PIECE_SOUNDS = Object.values(
  import.meta.glob("../assets/sounds/edited/pieces/*", {
    eager: true,
    as: "url",
  }),
).map((src) => new Audio(src as string));

import pieceBounceUrl from "../assets/sounds/edited/piece_bounce.ogg";
import successJingleUrl from "../assets/sounds/edited/successJingle.wav";
const BOUNCE_SOUND = new Audio(pieceBounceUrl);
const SUCCESS_JINGLE = new Audio(successJingleUrl);

export function playMoveSound() {
  const sound = PIECE_SOUNDS[Math.floor(Math.random() * PIECE_SOUNDS.length)];
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

export function playBounceSound() {
  BOUNCE_SOUND.currentTime = 0;
  BOUNCE_SOUND.play().catch(() => {});
}

export function playSuccessJingle() {
  SUCCESS_JINGLE.currentTime = 0;
  SUCCESS_JINGLE.play().catch(() => {});
}
