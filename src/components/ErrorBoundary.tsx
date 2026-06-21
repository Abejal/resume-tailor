import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
            <Button onClick={() => { this.setState({ error: null }); window.location.reload(); }}>
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
