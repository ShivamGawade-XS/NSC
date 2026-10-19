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
  'Global surface shortwave downward radiation shifts',
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
        } : { minLon: '', minLat: '', maxLon: '', maxLat: '' },
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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -10 }}
          className="w-full max-w-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded shadow-2xl overflow-hidden text-[var(--color-text-main)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
            <h2 className="text-xs font-semibold tracking-wider font-mono text-[var(--color-text-main)] uppercase">
              Spatiotemporal Query Palette
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">ESC</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] px-2 py-0.5 transition-colors"
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
                className="w-full bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] rounded px-3.5 py-2.5 text-xs text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-blue)] font-mono transition-colors"
              />
              <button
                type="button"
                disabled={isSearching}
                onClick={() => handleSubmit()}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 interface-btn-primary !py-1 !text-xs font-mono"
              >
                {isSearching ? 'Resolving...' : 'Execute'}
              </button>
            </div>

            {/* Suggestions */}
            <div className="mt-5">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-text-muted)] mb-2.5 font-semibold">
                Sample Research Inquiries
              </div>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuery(s);
                      handleSubmit(s);
                    }}
                    className="w-full text-left text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] px-3 py-2 rounded bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)] border border-[var(--color-border-subtle)] transition-all font-mono flex items-center justify-between group"
                  >
                    <span>{s}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] group-hover:text-[var(--color-accent-blue)] transition-colors" aria-hidden="true">&rarr;</span>
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
