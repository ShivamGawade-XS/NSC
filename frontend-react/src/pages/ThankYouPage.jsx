import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { usePageMetadata } from '../utils/usePageMetadata';
import { playTactileClick } from '../utils/audio';

export default function ThankYouPage() {
  usePageMetadata({
    title: 'Thank You — Tellura Scientific Workbench',
    description: 'Thank you for your scientific feedback and engagement with Tellura for NASA Space Apps Challenge 2026.',
    canonicalPath: '/thank-you',
  });

  const [copied, setCopied] = useState(false);
  const citationText = `@software{Tellura2026,
  author = {Gawade, Shivam},
  title = {Tellura: Statistical Detection of Multi-Decadal Trends in NASA Earth System Data},
  year = {2026},
  url = {https://github.com/ShivamGawade-XS/NSC},
  note = {NASA Space Apps Challenge 2026}
}`;

  const handleCopyCitation = () => {
    playTactileClick(750);
    navigator.clipboard.writeText(citationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-deep)] text-[var(--color-text-main)] flex flex-col justify-between">
      <Header />

      <main className="pt-24 pb-16 px-4 sm:px-6 flex-1 flex items-center justify-center">
        <div className="max-w-xl w-full p-8 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-center shadow-xl">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-[var(--color-text-main)] mb-3">
            Inquiry Received
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mb-6 leading-relaxed max-w-md mx-auto">
            Your inquiry, peer feedback, or researcher submission has been acknowledged. In accordance with NASA Open Science principles, all methodology, analytical algorithms, and reproducible pipelines remain transparent and publicly available.
          </p>

          {/* BibTeX Citation Box */}
          <div className="mb-6 text-left p-3.5 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] font-mono text-[11px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider">Academic Citation (BibTeX)</span>
              <button
                type="button"
                onClick={handleCopyCitation}
                className="text-[10px] text-[var(--color-accent-blue)] hover:underline flex items-center gap-1 font-semibold"
              >
                {copied ? '✓ Copied to Clipboard' : 'Copy BibTeX'}
              </button>
            </div>
            <pre className="text-[var(--color-text-secondary)] overflow-x-auto whitespace-pre leading-relaxed select-all">
              {citationText}
            </pre>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Link
              to="/dashboard"
              className="interface-btn-primary w-full sm:w-auto !text-xs !py-2.5 !px-5"
            >
              Launch Analysis Workspace
            </Link>
            <Link
              to="/"
              className="interface-btn-secondary w-full sm:w-auto !text-xs !py-2.5 !px-5"
            >
              Return to Overview
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

