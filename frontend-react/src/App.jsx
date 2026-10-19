import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import CookieConsentBanner from './components/CookieConsentBanner';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-deep)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-xs text-[var(--color-text-muted)] tracking-wider">
          LOADING INSTRUMENT...
        </span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <CookieConsentBanner />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

