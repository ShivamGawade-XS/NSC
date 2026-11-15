import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import CookieConsentBanner from './components/CookieConsentBanner';
import CommandPaletteModal from './components/CommandPaletteModal';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ThankYouPage = lazy(() => import('./pages/ThankYouPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RedirectWithQuery({ to }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search, hash: location.hash }} replace />;
}

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
            {/* Primary Core Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/investigate" element={<DashboardPage forcedMode="detective" />} />
            <Route path="/policy" element={<DashboardPage forcedMode="policy" />} />
            <Route path="/dashboard" element={<DashboardPage forcedMode="pro" />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/thank-you" element={<ThankYouPage />} />

            {/* Seamless Route Aliases & Trajectory Forwarding */}
            <Route path="/workspace" element={<RedirectWithQuery to="/dashboard" />} />
            <Route path="/workstation" element={<RedirectWithQuery to="/dashboard" />} />
            <Route path="/app" element={<RedirectWithQuery to="/dashboard" />} />
            <Route path="/explorer" element={<RedirectWithQuery to="/dashboard" />} />
            <Route path="/analytics" element={<RedirectWithQuery to="/dashboard" />} />
            <Route path="/analysis" element={<RedirectWithQuery to="/dashboard" />} />
            <Route path="/map" element={<RedirectWithQuery to="/dashboard" />} />
            <Route path="/pro" element={<RedirectWithQuery to="/dashboard" />} />
            <Route path="/detective" element={<RedirectWithQuery to="/investigate" />} />
            <Route path="/student" element={<RedirectWithQuery to="/investigate" />} />
            <Route path="/overview" element={<RedirectWithQuery to="/" />} />
            <Route path="/home" element={<RedirectWithQuery to="/" />} />

            {/* Trailing Slash Aliases */}
            <Route path="/dashboard/" element={<RedirectWithQuery to="/dashboard" />} />
            <Route path="/investigate/" element={<RedirectWithQuery to="/investigate" />} />
            <Route path="/policy/" element={<RedirectWithQuery to="/policy" />} />
            <Route path="/workspace/" element={<RedirectWithQuery to="/dashboard" />} />
            <Route path="/app/" element={<RedirectWithQuery to="/dashboard" />} />

            {/* Scientific 404 Fallback */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <CommandPaletteModal />
        <CookieConsentBanner />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-bg-surface, #0f172a)',
              color: 'var(--color-text-main, #f8fafc)',
              border: '1px solid var(--color-border-subtle, #334155)',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'monospace',
            },
          }}
        />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

