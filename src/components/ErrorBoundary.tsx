"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="relative overflow-hidden border border-rule bg-card px-6 py-12 text-center">
            <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
            <p className="kicker mb-3 text-text-faint">Erreur</p>
            <p className="text-sm text-text-muted">
              Une erreur est survenue lors du chargement de cette section.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
            >
              Réessayer
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
