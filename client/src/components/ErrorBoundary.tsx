import { Component, type ErrorInfo, type ReactNode } from "react";

// Catches a crash anywhere below it and shows a themed "try again" card instead of a
// blank page.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[hsl(25,30%,12%)] paper-texture flex items-center justify-center px-4">
        <div className="discovery-panel w-full" style={{ position: "relative", maxWidth: 480 }} role="alert">
          <div className="discovery-panel-header">
            <span>📡 Transmission Lost</span>
          </div>
          <div className="discovery-panel-body text-center text-[hsl(25,40%,20%)]">
            <p className="pulp-title text-lg text-[hsl(0,72%,42%)] tracking-wider mb-2">Houston, we have a problem.</p>
            <p className="text-sm leading-relaxed mb-4">This screen hit a snag. Your progress is safe on the server.</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button className="retro-btn gold text-sm" onClick={() => window.location.reload()} data-testid="button-reload-page">
                ★ Try again
              </button>
              <button
                className="retro-btn teal text-sm"
                onClick={() => {
                  window.location.hash = "#/";
                  window.location.reload();
                }}
                data-testid="button-error-home"
              >
                ← Back to the hub
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
