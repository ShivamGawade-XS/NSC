import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import * as api from '../api/client';
import { playTactileClick, playTelemetryChime } from '../utils/audio';

const SUGGESTIONS = [
  'Show me warming in North America from 1995 to 2022 with high confidence',
  'Mediterranean precipitation drought between 1990 and 2020',
  'Arctic amplification warming trends from 2000 to 2024',
  'Sahel hydrological greening trends',
  'Global solar radiation changes'
];

export default function CommandPaletteModal() {
  const isOpen = useStore((s) => s.nlqModalOpen);
  const setOpen = useStore((s) => s.setNlqModalOpen);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        playTactileClick(700);
        setOpen(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = async (textToRun) => {
    const q = textToRun || query;
    if (!q.trim()) return;
    setIsSearching(true);
    playTactileClick(880);
    const toastId = toast.loading('Parsing scientific intent...');

    try {
      const res = await api.parseNLQ(q);
      const req = res.analysis_request;
      toast.success(res.interpreted_intent, { id: toastId, duration: 4000 });
      playTelemetryChime();

      // Populate store
      useStore.setState({
        dataset: req.dataset_id,
        variable: req.variable_id,
        startYear: req.start_year,
        endYear: req.end_year,
        useFdr: req.use_fdr,
        bbox: req.bbox ? {
          minLon: req.bbox[0],
          minLat: req.bbox[1],
          maxLon: req.bbox[2],
          maxLat: req.bbox[3],
        } : { minLon: '', minLat: '', maxLon: '', maxLat: '' }
      });

      setOpen(false);
      setQuery('');
      // Trigger execution
      useStore.getState().executeAnalysis();
    } catch (err) {
      toast.error(`NLQ Failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSearching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="w-full max-w-2xl bg-[#080d1a] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-sm font-semibold text-white tracking-wide font-[var(--font-mono)]">
                NASA EARTHSIFT SEMANTIC COPILOT (NLQ)
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">ESC to close</span>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Input Box */}
          <div className="p-6">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Ask in natural language (e.g. 'Show warming in North America from 1995 to 2022')..."
                className="w-full bg-[#040711] border border-cyan-500/40 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono shadow-inner"
              />
              <button
                disabled={isSearching}
                onClick={() => handleSubmit()}
                className="absolute right-2 top-2 bottom-2 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
              >
                {isSearching ? 'Parsing...' : 'Execute ⏎'}
              </button>
            </div>

            {/* Suggestions */}
            <div className="mt-4">
              <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 mb-2">
                Example Scientific Queries
              </div>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(s);
                      handleSubmit(s);
                    }}
                    className="w-full text-left text-xs text-zinc-300 hover:text-cyan-300 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-cyan-950/30 border border-white/5 hover:border-cyan-500/30 transition-all font-mono flex items-center justify-between group"
                  >
                    <span>{s}</span>
                    <span className="text-[10px] text-zinc-500 group-hover:text-cyan-400">Run →</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
