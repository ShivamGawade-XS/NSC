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
        <div className="min-h-screen bg-[#08090b] text-[#f3f2ee] flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded bg-[#0e1014] border border-white/[0.08] text-center space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-950/40 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <span className="eyebrow-label text-red-400 block">SYSTEM EXCEPTION</span>
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#f3f2ee]">
              Interface Rendering Fault
            </h2>
            <p className="text-xs text-zinc-400">
              An unexpected exception occurred during component synchronization.
            </p>
            {this.state.error && (
              <pre className="text-[10px] font-mono bg-[#08090b] p-3 rounded border border-white/[0.08] text-red-300 overflow-x-auto text-left">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="interface-btn-primary !py-2 !px-4 !text-xs font-mono"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
