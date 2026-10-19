import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import * as api from '../api/client';
import { playTactileClick, playTelemetryChime } from '../utils/audio';

export default function LatexModal() {
  const isOpen = useStore((s) => s.latexModalOpen);
  const setOpen = useStore((s) => s.setLatexModalOpen);
  const analysisId = useStore((s) => s.analysisId);
  const [latexCode, setLatexCode] = useState('');
  const [colabLink, setColabLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (isOpen && analysisId) {
      // Schedule loading state cleanly
      const timer = setTimeout(() => {
        if (!ignore) setIsLoading(true);
      }, 0);

      Promise.all([
        api.exportLatex(analysisId),
        api.getColabLink(analysisId),
      ])
        .then(async ([latexRes, colabRes]) => {
          if (ignore) return;
          const text = await latexRes.blob.text();
          setLatexCode(text);
          setColabLink(colabRes.colab_launcher_url);
          playTelemetryChime();
        })
        .catch((err) => {
          if (!ignore) toast.error(`Failed to load memorandum: ${err.message}`);
        })
        .finally(() => {
          if (!ignore) setIsLoading(false);
        });

      return () => {
        ignore = true;
        clearTimeout(timer);
      };
    }
  }, [isOpen, analysisId]);

  const handleCopy = () => {
    playTactileClick(800);
    navigator.clipboard.writeText(latexCode)
      .then(() => toast.success('LaTeX source copied'))
      .catch(() => toast('Clipboard error'));
  };

  const handleDownload = () => {
    playTactileClick(600);
    api.exportLatex(analysisId).then(({ blob, filename, mime }) => {
      api.downloadBlob(blob, filename, mime);
      toast.success('LaTeX document downloaded');
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="w-full max-w-3xl max-h-[85vh] bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded shadow-2xl flex flex-col overflow-hidden text-[var(--color-text-main)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
            <h2 className="text-xs font-semibold tracking-wider font-mono text-[var(--color-text-main)] uppercase">
              NASA Technical Memorandum • IEEE/AGU LaTeX Specification
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] text-xs px-2 py-0.5 font-mono transition-colors"
            >
              Close
            </button>
          </div>

          {/* Subheader */}
          <div className="px-5 py-2.5 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)] font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-main)] border border-[var(--color-border-subtle)]">
                CF-1.8 Metadata Package
              </span>
              <span>•</span>
              <span>AGU / AMS Article Template</span>
            </div>
            <div className="flex items-center gap-2">
              <form
                action="https://www.overleaf.com/docs"
                method="POST"
                target="_blank"
                className="inline-block"
              >
                <input type="hidden" name="snip" value={latexCode} />
                <button
                  type="submit"
                  disabled={!latexCode || isLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono text-xs transition-colors disabled:opacity-40"
                  title="Open directly in Overleaf Cloud LaTeX Editor"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
                  </svg>
                  <span>Open in Overleaf &rarr;</span>
                </button>
              </form>
              {colabLink && (
                <a
                  href={colabLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 border border-[#f59e0b]/30 text-[#f59e0b] font-mono text-xs transition-colors"
                >
                  <span>Launch in Google Colab &rarr;</span>
                </a>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto flex-1 font-mono text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-deep)]">
            {isLoading ? (
              <div className="py-20 text-center text-[var(--color-text-muted)] font-mono">
                Compiling mathematical formulations and IEEE memorandum...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap leading-relaxed select-all">
                {latexCode}
              </pre>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
              Ready for Overleaf / TeX Live compilation
            </span>
            <div className="flex items-center gap-2">
              <form
                action="https://www.overleaf.com/docs"
                method="POST"
                target="_blank"
                className="inline-block"
              >
                <input type="hidden" name="snip" value={latexCode} />
                <button
                  type="submit"
                  disabled={!latexCode || isLoading}
                  className="interface-btn-secondary !text-xs !py-1.5 font-mono text-emerald-400 hover:text-emerald-300 border-emerald-500/40 disabled:opacity-40"
                >
                  Open in Overleaf
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  playTactileClick(750);
                  setOpen(false);
                  useStore.getState().setPreprintModalOpen(true);
                }}
                className="interface-btn-secondary !text-xs !py-1.5 font-mono text-rose-400 hover:text-rose-300 border-rose-500/40"
              >
                AGU Preprint (PDF)
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="interface-btn-secondary !text-xs !py-1.5 font-mono"
              >
                Copy LaTeX
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="interface-btn-primary !text-xs !py-1.5 font-mono"
              >
                Download .tex
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
