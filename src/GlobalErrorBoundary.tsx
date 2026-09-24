import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "white", backgroundColor: "black", minHeight: "100vh" }}>
          <h1 style={{ color: "red" }}>App Crashed!</h1>
          <p>Please share this error with the AI:</p>
          <pre style={{ color: "lightcoral" }}>{this.state.error?.toString()}</pre>
          <pre style={{ fontSize: "12px", color: "gray" }}>{this.state.error?.stack}</pre>
          {this.state.errorInfo && <pre style={{ fontSize: "12px", color: "gray" }}>{this.state.errorInfo.componentStack}</pre>}
        </div>
      );
    }

    return this.props.children;
  }
}
