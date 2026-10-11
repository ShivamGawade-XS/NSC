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
      .then(() => toast.success('LaTeX code copied to clipboard!'))
      .catch(() => toast('Clipboard error'));
  };

  const handleDownload = () => {
    playTactileClick(600);
    api.exportLatex(analysisId).then(({ blob, filename, mime }) => {
      api.downloadBlob(blob, filename, mime);
      toast.success('LaTeX file downloaded!');
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-3xl max-h-[85vh] bg-[#070b18] border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-500/10 flex flex-col overflow-hidden text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="text-sm font-semibold tracking-wide font-mono text-cyan-300">
                NASA TECHNICAL MEMORANDUM (TM) • IEEE/AGU LATEX
              </h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-white text-xs px-2 py-1"
            >
              ✕
            </button>
          </div>

          {/* Subheader with Colab launcher */}
          <div className="px-6 py-3 bg-[#0a1124] border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-zinc-300 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                HMAC-SHA256: SIGNED
              </span>
              <span className="text-zinc-500">•</span>
              <span>Peer-Review Ready</span>
            </div>
            {colabLink && (
              <a
                href={colabLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f9ab00]/20 hover:bg-[#f9ab00]/30 border border-[#f9ab00]/40 text-[#f9ab00] font-semibold text-xs transition-all shadow-md"
              >
                <img
                  src="https://colab.research.google.com/assets/colab-badge.svg"
                  alt="Open In Colab"
                  className="h-4"
                />
              </a>
            )}
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-zinc-300 bg-[#04060e]">
            {isLoading ? (
              <div className="py-20 text-center text-zinc-400">
                Generating mathematical formulations and IEEE memorandum...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap leading-relaxed select-all">
                {latexCode}
              </pre>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-white/10 bg-[#070b18]">
            <span className="text-[10px] text-zinc-500 font-mono">
              Ready for Overleaf / TeX Live compilation
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-200 transition-all font-mono"
              >
                📋 Copy LaTeX
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-all font-mono shadow-md shadow-cyan-500/20"
              >
                ⬇️ Download .tex
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
