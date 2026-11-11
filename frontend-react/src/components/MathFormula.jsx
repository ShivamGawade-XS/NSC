import { useMemo } from 'react';
import katex from 'katex';

/**
 * Renders a mathematical formulation with KaTeX.
 * Gracefully falls back to raw LaTeX string if compilation encounters any issue.
 */
export default function MathFormula({ formula, displayMode = true, className = '' }) {
  const html = useMemo(() => {
    if (!formula) return '';
    try {
      return katex.renderToString(formula, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return '';
    }
  }, [formula, displayMode]);

  if (!html) {
    return (
      <code className={`font-mono text-xs ${className}`}>
        {formula}
      </code>
    );
  }

  return (
    <div
      className={`overflow-x-auto select-all text-center py-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
