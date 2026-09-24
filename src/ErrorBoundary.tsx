import React from 'react';
import type { ReactNode } from 'react';
import { Html } from '@react-three/drei';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div style={{ padding: 20, color: 'white', backgroundColor: 'red', width: 600, height: 400, overflow: 'auto', borderRadius: 8 }}>
            <h2>Pyraminx Crash!</h2>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error?.toString()}</pre>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10 }}>{this.state.error?.stack}</pre>
          </div>
        </Html>
      );
    }
    return this.props.children; 
  }
}
