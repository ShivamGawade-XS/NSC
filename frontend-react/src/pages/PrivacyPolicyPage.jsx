import { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { trackPageView } from '../utils/analytics';

export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy — EarthSift';
    trackPageView('Privacy Policy');
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg-deep)] text-[var(--color-text-main)] flex flex-col justify-between">
      <Header />

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto flex-1 w-full">
        <header className="mb-10 pb-6 border-b border-[var(--color-border-subtle)]">
          <span className="eyebrow-label block mb-2 text-[var(--color-accent-blue)]">
            GOVERNANCE & PRIVACY
          </span>
          <h1 className="font-['Space_Grotesk'] text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] font-mono">
            Effective Date: October 19, 2026 • EarthSift Open Science Protocol
          </p>
        </header>

        <article className="space-y-8 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          <section className="space-y-3">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
              1. Fundamental Privacy Commitment
            </h2>
            <p>
              EarthSift is an open-science climate trend discovery instrument built for the NASA Space Apps Challenge 2026. We are committed to transparency, data minimization, and the complete elimination of surveillance capitalism. We do not sell, rent, monetize, or broker any user data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
              2. Data We Do Not Collect
            </h2>
            <p>
              We do not collect names, email addresses, phone numbers, location tracking records, device fingerprinting tokens, or social identity graphs. All data ingestion queries executed against NASA POWER and MERRA-2 are non-identifiable scientific coordinate bounding boxes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
              3. Local Browser Storage
            </h2>
            <p>
              EarthSift utilizes client-side Web Storage APIs (<code>localStorage</code> and IndexedDB) strictly for functional application performance:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs font-mono">
              <li><code>earthsift_theme</code>: Remembers your Light or Dark display choice.</li>
              <li><code>earthsift_consent</code>: Records your acknowledgment of local preference storage.</li>
              <li><code>earthdata_cache</code>: Caches recent NASA satellite query bounding boxes locally on your machine to prevent redundant network bandwidth consumption.</li>
            </ul>
            <p>
              You can clear these at any time via your browser settings or Developer Tools.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
              4. NASA Earthdata Ingestion
            </h2>
            <p>
              When communicating with NASA Langley Research Center (POWER) or NASA GMAO (MERRA-2) reanalysis servers, requests are routed directly to NASA's public scientific APIs. If optional NASA Earthdata credentials are provided in self-hosted environments, they are stored securely on the user’s self-hosted server environment and never transmitted to external third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
              5. Analytics and 'Do Not Track' Respect
            </h2>
            <p>
              EarthSift respects standard browser privacy signals, including <code>navigator.doNotTrack</code> and Global Privacy Control (GPC). If your browser transmits a Do Not Track header, all client-side event tracking is unconditionally disabled.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
              6. Open Source Verification
            </h2>
            <p>
              In accordance with NASA Open Science directives, the entire source code of EarthSift is publicly inspectable on GitHub. You can review and verify our client-side storage, networking calls, and cryptographic hashing directly in the repository:
            </p>
            <p className="font-mono text-xs">
              <a
                href="https://github.com/ShivamGawade-XS/NSC"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent-blue)] hover:underline"
              >
                https://github.com/ShivamGawade-XS/NSC
              </a>
            </p>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}
