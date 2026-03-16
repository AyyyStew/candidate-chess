export default function AboutPage() {
  return (
    <main className="max-w-2xl mx-auto px-8 py-16 flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <h1 className="font-black text-3xl tracking-tight">About</h1>
        <p className="text-label leading-relaxed">
          Candidate Chess is a chess training app built around one question:{" "}
          <em className="text-text not-italic font-semibold">
            what do I do here?
          </em>
        </p>
        <p className="text-label leading-relaxed">
          You're shown a position and asked to find the engine's top 5 moves,
          Family Feud style — no eval bar, no hints. The goal is to force
          deliberate candidate move thinking before reaching for the engine.
        </p>
        <p className="text-muted leading-relaxed">
          Loosely inspired by the Kotov method. Built by an 800 elo player, so
          take that with a grain of salt.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-lg tracking-tight text-text">Modes</h2>
        <dl className="flex flex-col gap-3">
          {[
            { term: "Daily", def: "A shared daily position for everyone." },
            {
              term: "Random",
              def: "A random position from the precomputed set.",
            },
            { term: "Custom", def: "Upload your own FEN or position." },
            {
              term: "Study",
              def: "An analysis board where engine evals and top moves stay hidden until you ask.",
            },
          ].map(({ term, def }) => (
            <div key={term} className="flex gap-3">
              <dt className="text-sm font-semibold text-accent w-16 shrink-0 pt-0.5">
                {term}
              </dt>
              <dd className="text-muted text-sm leading-relaxed">{def}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-lg tracking-tight text-text">
          Under the hood
        </h2>
        <p className="text-muted text-sm leading-relaxed">
          Runs in the browser via React, Tailwind, and Stockfish 18 (WASM).
          Precomputed positions were generated with local Stockfish 18 at depth
          15 and selected through a custom pipeline —{" "}
          <a
            href="https://github.com/AyyyStew/candidate-chess/tree/master/position_generation"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-hi underline underline-offset-2 transition-colors"
          >
            details on GitHub
          </a>
          .
        </p>
      </div>
    </main>
  );
}
