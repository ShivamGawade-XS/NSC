import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { playTactileClick } from '../utils/audio';
import { trackEvent } from '../utils/analytics';

export default function ContactModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: 'scientific_review',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

    // Store in session storage for the thank you page
    try {
      sessionStorage.setItem('tellura_last_inquiry', JSON.stringify({
        name: formData.name,
        topic: formData.topic,
        timestamp: new Date().toISOString(),
      }));
    } catch {
      // Storage unavailable
    }

    // POST to real backend contact endpoint
    fetch('/api/v1/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        topic: formData.topic,
        message: formData.message,
      }),
    })
      .then(async (res) => {
        if (res.status === 429) {
          setErrors({ message: 'Too many submissions — please wait a minute and try again.' });
          setSubmitting(false);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setErrors({ message: body.detail || 'Submission failed. Please email us directly.' });
          setSubmitting(false);
          return;
        }
        setSubmitting(false);
        onClose?.();
        navigate('/thank-you');
      })
      .catch(() => {
        setErrors({ message: 'Network error — please email nsc26cs@gmail.com directly.' });
        setSubmitting(false);
      });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="max-w-lg w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded p-6 shadow-2xl relative text-[var(--color-text-main)] max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            playTactileClick(500);
            onClose?.();
          }}
          className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] p-1 rounded font-mono text-sm"
          aria-label="Close Contact Dialog"
        >
          ✕
        </button>

        <div className="mb-5">
          <span className="eyebrow-label text-[var(--color-accent-blue)] block mb-1">
            RESEARCH & INQUIRIES
          </span>
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

        <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs font-sans">
          {/* Name Field */}
          <div>
            <label htmlFor="contact-name" className="block font-mono text-[11px] text-[var(--color-text-secondary)] mb-1">
              Your Name / Institution *
            </label>
            <input
              id="contact-name"
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
              <p id="contact-name-error" className="mt-1 text-[11px] text-red-400 font-mono flex items-center gap-1">
                <span>⚠</span> {errors.name}
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
              <p id="contact-email-error" className="mt-1 text-[11px] text-red-400 font-mono flex items-center gap-1">
                <span>⚠</span> {errors.email}
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
              <p id="contact-message-error" className="mt-1 text-[11px] text-red-400 font-mono flex items-center gap-1">
                <span>⚠</span> {errors.message}
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
              className="interface-btn-secondary !py-2 !px-4 !text-xs font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="interface-btn-primary !py-2 !px-5 !text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
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
      </div>
    </div>
  );
}

