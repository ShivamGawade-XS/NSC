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
    if (isOpen && analysisId) {
      setIsLoading(true);
      Promise.all([
        api.exportLatex(analysisId),
        api.getColabLink(analysisId)
      ])
        .then(async ([latexRes, colabRes]) => {
          const text = await latexRes.blob.text();
          setLatexCode(text);
          setColabLink(colabRes.colab_launcher_url);
          playTelemetryChime();
        })
        .catch((err) => toast.error(`Failed to load memorandum: ${err.message}`))
        .finally(() => setIsLoading(false));
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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="w-full max-w-3xl max-h-[85vh] bg-[#0B0E14] border border-white/15 rounded-lg shadow-2xl flex flex-col overflow-hidden text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h2 className="text-xs font-semibold tracking-wider font-mono text-zinc-200 uppercase">
                NASA Technical Memorandum • IEEE/AGU LaTeX Specification
              </h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-white text-xs px-1.5 py-0.5 font-mono"
            >
              Close
            </button>
          </div>

          {/* Subheader */}
          <div className="px-5 py-2.5 bg-white/[0.02] border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                HMAC-SHA256 Cryptographic Verification
              </span>
              <span>•</span>
              <span>CF-1.8 Compliant Ledger</span>
            </div>
            {colabLink && (
              <a
                href={colabLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs transition-colors"
              >
                <span>Launch in Google Colab &rarr;</span>
              </a>
            )}
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto flex-1 font-mono text-xs text-zinc-300 bg-[#06080D]">
            {isLoading ? (
              <div className="py-20 text-center text-zinc-500 font-mono">
                Compiling mathematical formulations and IEEE memorandum...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap leading-relaxed select-all">
                {latexCode}
              </pre>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-[#0B0E14]">
            <span className="text-[10px] text-zinc-500 font-mono">
              Ready for Overleaf / TeX Live compilation
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-200 transition-colors font-mono"
              >
                Copy LaTeX
              </button>
              <button
                onClick={handleDownload}
                className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors font-mono"
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
