import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[SectionErrorBoundary]", this.props.label, error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="font-display text-base font-bold text-destructive">
            {this.props.label ?? "Bereich"} konnte nicht geladen werden
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {this.state.error.message || "Unbekannter Fehler"}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-3 rounded-md border border-border bg-background/60 px-3 py-1 text-xs hover:border-gold/50 hover:text-gold"
          >
            Erneut versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
