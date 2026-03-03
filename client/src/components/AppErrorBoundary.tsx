import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string | null;
  componentStack: string | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
    componentStack: null,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, errorInfo);
    this.setState({
      errorMessage: error?.message ?? "Unknown runtime error",
      componentStack: errorInfo?.componentStack ?? null,
    });
  }

  private handleGoHome = () => {
    if (typeof window !== "undefined") {
      window.location.replace("/app/private");
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 text-center space-y-3">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              We could not load this screen. You can return to your plans and continue.
            </p>
            {this.state.errorMessage ? (
              <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground">
                {this.state.errorMessage}
              </p>
            ) : null}
            {this.state.componentStack ? (
              <pre className="max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-left text-[10px] leading-snug text-muted-foreground whitespace-pre-wrap">
                {this.state.componentStack}
              </pre>
            ) : null}
            <Button type="button" onClick={this.handleGoHome}>
              Go to Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
