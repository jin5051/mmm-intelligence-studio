import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#080c14] text-white">
          <div className="glass-panel p-8 rounded-2xl max-w-lg text-center border border-rose-500/30">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-lg font-bold mb-2">대시보드 렌더링 오류 발생</h2>
            <p className="text-xs text-slate-400 mb-4 font-mono bg-slate-900 p-3 rounded text-left overflow-x-auto">
              {this.state.error?.toString()}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" /> 새로고침하기
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
