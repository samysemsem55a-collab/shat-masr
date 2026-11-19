import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application boundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          lang="ar"
          className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6 text-slate-900"
        >
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h1 className="text-lg font-extrabold text-slate-900">حدث خطأ غير متوقع</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              واجه التطبيق مشكلة مؤقتة أثناء العرض. يمكنك إعادة تحميل الصفحة لاستعادة جلستك فوراً.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
