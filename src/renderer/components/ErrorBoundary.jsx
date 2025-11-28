import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-cinema-dark border border-red-500 rounded-lg p-6 max-w-md">
            <h2 className="text-red-400 font-bold mb-3 flex items-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              Ayarlar Hatası
            </h2>
            <p className="text-cinema-text mb-3">
              Ayarlar menüsü açılırken bir hata oluştu.
            </p>
            <details className="mb-4">
              <summary className="text-cinema-text-dim cursor-pointer text-sm">
                Hata detayları
              </summary>
              <pre className="text-xs text-red-300 mt-2 bg-black/30 p-2 rounded overflow-auto max-h-32">
                {this.state.error && this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
            <div className="flex gap-2">
              <button 
                onClick={() => this.setState({ hasError: false })}
                className="btn-secondary px-3 py-2 text-sm"
              >
                Tekrar Dene
              </button>
              <button 
                onClick={this.props.onClose}
                className="btn-primary px-3 py-2 text-sm"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;