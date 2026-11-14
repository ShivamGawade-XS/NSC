import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { playTactileClick, playTelemetryChime } from '../utils/audio';
import { trackEvent } from '../utils/analytics';

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : '/api/v1');

export default function ContactModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: 'scientific_review',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);

  const handleClose = useCallback(() => {
    setErrors({});
    setSubmitting(false);
    setSubmittedResult(null);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Please provide your name or academic affiliation.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Please provide a valid research or institutional email.';
    }
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      newErrors.message = 'Inquiry message must be at least 10 characters long.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) {
      playTactileClick(400);
      return;
    }

    playTactileClick(750);
    setSubmitting(true);
    trackEvent('contact_form_submit', { topic: formData.topic });

    // Store in session storage for reference
    try {
      sessionStorage.setItem('tellura_last_inquiry', JSON.stringify({
        name: formData.name,
        topic: formData.topic,
        timestamp: new Date().toISOString(),
      }));
    } catch {
      // Storage unavailable
    }

    // POST to backend contact endpoint using robust API_BASE
    const targetUrl = API_BASE.endsWith('/contact') ? API_BASE : `${API_BASE}/contact`;

    fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name.trim(),
        email: formData.email.trim(),
        topic: formData.topic,
        message: formData.message.trim(),
      }),
    })
      .then(async (res) => {
        if (res.status === 429) {
          setErrors({ message: 'Rate limit: Too many submissions. Please wait 1 minute.' });
          setSubmitting(false);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrors({ message: data.detail || 'Submission could not be completed. Please email us directly.' });
          setSubmitting(false);
          return;
        }
        playTelemetryChime();
        setSubmitting(false);
        setSubmittedResult({
          receipt_id: data.receipt_id || `inq_${Math.random().toString(36).substring(2, 10)}`,
          message: data.message || 'Inquiry successfully received.',
        });
      })
      .catch(() => {
        setErrors({ message: 'Network connection error — please reach out to nsc26cs@gmail.com directly.' });
        setSubmitting(false);
      });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="max-w-lg w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-lg p-6 shadow-2xl relative text-[var(--color-text-main)] max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            playTactileClick(500);
            handleClose();
          }}
          className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] p-1 rounded hover:bg-[var(--color-bg-deep)] transition-colors cursor-pointer"
          aria-label="Close Contact Dialog"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {submittedResult ? (
          /* Success In-Modal Screen */
          <div className="py-4 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>

            <div>
              <h3 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
                Inquiry Logged Successfully
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-sm mx-auto">
                Thank you, <strong className="text-[var(--color-text-main)]">{formData.name}</strong>. Your communication has been recorded in the review inbox.
              </p>
            </div>

            <div className="p-3 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] font-mono text-[11px] text-left space-y-1">
              <div className="flex items-center justify-between text-[var(--color-text-muted)]">
                <span>Receipt Tracking ID</span>
                <span className="text-[var(--color-accent-blue)] font-bold">{submittedResult.receipt_id}</span>
              </div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">
                Direct Contact: <a href="mailto:nsc26cs@gmail.com" className="text-[var(--color-accent-blue)] hover:underline">nsc26cs@gmail.com</a>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  playTactileClick(500);
                  handleClose();
                }}
                className="w-full sm:w-auto px-5 py-2 rounded bg-[var(--color-accent-blue)] text-white text-xs font-bold hover:bg-[var(--color-accent-blue)]/90 transition-colors cursor-pointer"
              >
                Close & Return to Workstation
              </button>
              <Link
                to="/thank-you"
                onClick={() => handleClose()}
                className="text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:underline"
              >
                View BibTeX Citation →
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Contact Form */
          <>
            <div className="mb-5">
              <h2 id="contact-modal-title" className="font-['Space_Grotesk'] text-xl font-bold">
                Contact Project Team
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Connect with the authors for peer review, scientific questions, or Space Apps judging inquiries.
              </p>
            </div>

            {/* Real Contact Details Box */}
            <div className="mb-5 p-3 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] font-mono text-[11px] space-y-1">
              <div className="text-[var(--color-text-secondary)]">
                <strong className="text-[var(--color-text-main)]">Lead Developer:</strong> Shivam Gawade
              </div>
              <div className="text-[var(--color-text-secondary)]">
                <strong className="text-[var(--color-text-main)]">Direct Email:</strong>{' '}
                <a href="mailto:nsc26cs@gmail.com" className="text-[var(--color-accent-blue)] hover:underline">
                  nsc26cs@gmail.com
                </a>
              </div>
              <div className="text-[var(--color-text-secondary)]">
                <strong className="text-[var(--color-text-main)]">GitHub:</strong>{' '}
                <a href="https://github.com/ShivamGawade-XS/NSC" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-blue)] hover:underline">
                  github.com/ShivamGawade-XS/NSC ↗
                </a>
              </div>
            </div>

            {errors.message && (
              <div className="mb-4 p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
                {errors.message}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs font-sans">
              {/* Name Field */}
              <div>
                <label htmlFor="contact-name" className="block font-mono text-[11px] text-[var(--color-text-secondary)] mb-1">
                  Your Name / Institution *
                </label>
                <input
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (errors.name) setErrors({ ...errors, name: '' });
                  }}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'contact-name-error' : undefined}
                  className={`w-full p-2 rounded bg-[var(--color-bg-deep)] border ${
                    errors.name ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-[var(--color-border-subtle)] focus:border-[var(--color-accent-blue)]'
                  } text-[var(--color-text-main)] outline-none transition-colors`}
                  placeholder="e.g. Dr. Jane Doe (Atmospheric Sciences)"
                />
                {errors.name && (
                  <p id="contact-name-error" className="mt-1 text-[11px] text-red-400 font-mono flex items-center gap-1.5">
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="contact-email" className="block font-mono text-[11px] text-[var(--color-text-secondary)] mb-1">
                  Contact Email *
                </label>
                <input
                  id="contact-email"
                  name="email"
                  autoComplete="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (errors.email) setErrors({ ...errors, email: '' });
                  }}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'contact-email-error' : undefined}
                  className={`w-full p-2 rounded bg-[var(--color-bg-deep)] border ${
                    errors.email ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-[var(--color-border-subtle)] focus:border-[var(--color-accent-blue)]'
                  } text-[var(--color-text-main)] outline-none transition-colors`}
                  placeholder="name@institution.edu"
                />
                {errors.email && (
                  <p id="contact-email-error" className="mt-1 text-[11px] text-red-400 font-mono flex items-center gap-1.5">
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              {/* Topic Selector */}
              <div>
                <label htmlFor="contact-topic" className="block font-mono text-[11px] text-[var(--color-text-secondary)] mb-1">
                  Inquiry Subject
                </label>
                <select
                  id="contact-topic"
                  name="topic"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  className="w-full p-2 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] text-[var(--color-text-main)] outline-none focus:border-[var(--color-accent-blue)] transition-colors"
                >
                  <option value="scientific_review">NASA Space Apps Challenge Review</option>
                  <option value="citation">Scientific Citation & Methodology</option>
                  <option value="data_pipeline">NetCDF / CF-1.8 Integration</option>
                  <option value="bug_security">Bug Report or Security Disclosure</option>
                </select>
              </div>

              {/* Message Field */}
              <div>
                <label htmlFor="contact-message" className="block font-mono text-[11px] text-[var(--color-text-secondary)] mb-1">
                  Message *
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={(e) => {
                    setFormData({ ...formData, message: e.target.value });
                    if (errors.message) setErrors({ ...errors, message: '' });
                  }}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? 'contact-message-error' : undefined}
                  className={`w-full p-2 rounded bg-[var(--color-bg-deep)] border ${
                    errors.message ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-[var(--color-border-subtle)] focus:border-[var(--color-accent-blue)]'
                  } text-[var(--color-text-main)] outline-none transition-colors resize-none`}
                  placeholder="Your scientific comments, feedback, or inquiry..."
                />
                {errors.message && (
                  <p id="contact-message-error" className="mt-1 text-[11px] text-red-400 font-mono flex items-center gap-1.5">
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>{errors.message}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--color-border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    playTactileClick(500);
                    onClose?.();
                  }}
                  className="interface-btn-secondary !py-2 !px-4 !text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting}
                  className="interface-btn-primary !py-2 !px-5 !text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <span className="loading-spinner !w-3 !h-3 !border-2" />
                      <span>Transmitting...</span>
                    </>
                  ) : (
                    <span>Send Inquiry →</span>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
