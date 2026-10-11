import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[hsl(25,30%,12%)] paper-texture flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        <div className="starburst-badge mx-auto mb-4" style={{ width: 72, height: 72, fontSize: "0.65rem" }}>
          ALERT!
        </div>
        <h1 className="pulp-title text-5xl md:text-6xl text-[hsl(45,80%,55%)] tracking-wider drop-shadow-lg mb-2">
          LOST IN SPACE
        </h1>
        <p className="pulp-title text-xl text-[hsl(0,72%,55%)] tracking-wider mb-4">
          ERROR 404 — SIGNAL NOT FOUND
        </p>
        <div className="comic-panel p-6 bg-[hsl(38,35%,88%)] mb-6">
          <p className="text-sm text-[hsl(25,40%,20%)] leading-relaxed marker-text">
            Your navigation computer has locked onto a sector of deep space where no pages exist.
            The void stretches endlessly in every direction. Recommend immediate course correction
            back to charted territory.
          </p>
        </div>
        <Link href="/">
          <button className="retro-btn gold text-lg" data-testid="button-404-home">
            ★ Back to the menu ★
          </button>
        </Link>
        <p className="text-[hsl(38,20%,40%)] text-xs mt-6 marker-text tracking-widest uppercase">
          ★ The future isn't what it used to be ★
        </p>
      </div>
    </div>
  );
}
