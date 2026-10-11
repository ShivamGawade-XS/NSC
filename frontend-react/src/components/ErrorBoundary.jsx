import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('EarthSift ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050507] text-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-card p-6 border-red-500/30 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center text-xl">
              ⚠️
            </div>
            <h2 className="text-base font-bold font-[var(--font-display)]">Telemetry Rendering Anomaly</h2>
            <p className="text-xs text-zinc-400">
              An unexpected component error occurred while rendering the geospatial interface.
            </p>
            {this.state.error && (
              <pre className="text-[10px] font-mono bg-black/50 p-3 rounded text-red-300 overflow-x-auto text-left">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#3B82F6] text-[#050507] font-bold text-xs"
            >
              🔄 Reload Mission Console
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
