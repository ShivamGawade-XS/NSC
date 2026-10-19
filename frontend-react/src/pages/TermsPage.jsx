import { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { trackPageView } from '../utils/analytics';

export default function TermsPage() {
  useEffect(() => {
    document.title = 'Terms of Service — EarthSift';
    trackPageView('Terms of Service');
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg-deep)] text-[var(--color-text-main)] flex flex-col justify-between">
      <Header />

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto flex-1 w-full">
        <header className="mb-10 pb-6 border-b border-[var(--color-border-subtle)]">
          <span className="eyebrow-label block mb-2 text-[var(--color-accent-blue)]">
            LEGAL & ATTRIBUTION
          </span>
          <h1 className="font-['Space_Grotesk'] text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Terms of Service & Scientific Attribution
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] font-mono">
            Last Updated: October 19, 2026 • NASA Space Apps Challenge 2026
          </p>
        </header>

        <article className="space-y-8 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          <section className="space-y-3">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
              1. Platform Purpose & License
            </h2>
            <p>
              EarthSift is an evidence-first open science instrument developed for the NASA Space Apps Challenge 2026 challenge: <em>"Be an Earth System Trend Detective"</em>. The application and analytical algorithms are licensed under the terms of the MIT License, granting permission for free use, study, modification, and academic distribution.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
              2. Scientific Data Attribution
            </h2>
            <p>
              Any academic publications, research dossiers, or derivative figures produced using EarthSift must appropriately cite the primary NASA observation sources:
            </p>
            <div className="space-y-2 text-xs font-mono bg-[var(--color-bg-elevated)] p-4 rounded border border-[var(--color-border-subtle)]">
              <p>
                <strong>NASA POWER (Langley Research Center):</strong><br />
                NASA Prediction Of Worldwide Energy Resources (POWER) Project. Climatology Resource for Agroclimatology and Meteorology. DOI: 10.5067/POWER/10.0.0.
              </p>
              <p>
                <strong>NASA MERRA-2 (GMAO):</strong><br />
                Global Modeling and Assimilation Office (GMAO), Modern-Era Retrospective analysis for Research and Applications, Version 2. Goddard Earth Sciences Data and Information Services Center (GES DISC). DOI: 10.5067/A7F0JNNUTWOB.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
              3. Statistical Disclaimers
            </h2>
            <p>
              EarthSift computes deterministic non-parametric statistics (Mann-Kendall rank correlation, Theil-Sen robust slope estimation, Benjamini-Hochberg FDR correction, and Anselin Local Moran’s I). While these mathematical models follow peer-reviewed scientific literature, observational reanalysis products are subject to sensor drift, reanalysis grid resolutions, and interpolation uncertainty.
            </p>
            <p>
              Data provided through EarthSift is intended for scientific research, educational exploration, and climate analysis. It should not be used as the sole basis for life-critical disaster management without consulting official regional meteorological authorities.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[var(--color-text-main)]">
              4. Code Availability & Reproducibility
            </h2>
            <p>
              Full source code, reproducible Jupyter notebooks, and CF-1.8 NetCDF-4 export scripts are maintained publicly under version control at:
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
