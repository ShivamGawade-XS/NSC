import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import * as api from '../api/client';
import { playTactileClick, playTelemetryChime } from '../utils/audio';

const SUGGESTIONS = [
  'Warming trends in North America from 1995 to 2022 (high confidence)',
  'Mediterranean precipitation deficit between 1990 and 2020',
  'Arctic amplification surface temperature from 2000 to 2024',
  'Sahel hydrological greening transition trends',
  'Global surface shortwave downward radiation shifts'
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
    const toastId = toast.loading('Parsing query parameters...');

    try {
      const res = await api.parseNLQ(q);
      const req = res.analysis_request;
      toast.success(res.interpreted_intent, { id: toastId, duration: 3500 });
      playTelemetryChime();

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
      useStore.getState().executeAnalysis();
    } catch (err) {
      toast.error(`Query resolution error: ${err.message}`, { id: toastId });
    } finally {
      setIsSearching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -10 }}
          className="w-full max-w-2xl bg-[#0B0E14] border border-white/15 rounded-lg shadow-2xl overflow-hidden text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <h2 className="text-xs font-semibold tracking-wider font-mono text-zinc-200 uppercase">
                Natural Language Spatial Query Palette
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">ESC</span>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-white px-1.5 py-0.5"
              >
                Close
              </button>
            </div>
          </div>

          {/* Input Box */}
          <div className="p-5">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Enter spatiotemporal inquiry (e.g., 'Surface warming in North America from 1995 to 2022')..."
                className="w-full bg-[#05070B] border border-white/20 rounded-md px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-400 font-mono"
              />
              <button
                disabled={isSearching}
                onClick={() => handleSubmit()}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded transition-colors flex items-center font-mono"
              >
                {isSearching ? 'Resolving...' : 'Execute'}
              </button>
            </div>

            {/* Suggestions */}
            <div className="mt-4">
              <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 mb-2">
                Sample Research Inquiries
              </div>
              <div className="space-y-1">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(s);
                      handleSubmit(s);
                    }}
                    className="w-full text-left text-xs text-zinc-300 hover:text-white px-3 py-2 rounded bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-colors font-mono flex items-center justify-between group"
                  >
                    <span>{s}</span>
                    <span className="text-[10px] text-zinc-500 group-hover:text-blue-400">&rarr;</span>
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
