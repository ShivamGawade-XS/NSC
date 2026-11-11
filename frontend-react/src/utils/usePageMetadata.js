import { useEffect } from 'react';

/**
 * Updates DOM title, meta description, Open Graph, and Twitter metadata per route.
 */
export function usePageMetadata({
  title,
  description,
  canonicalPath = '',
  ogImage = '/og-image.png',
  ogType = 'website',
}) {
  useEffect(() => {
    // 1. Update Title
    if (title) {
      document.title = title;
    }

    // Helper to safely update or append a meta tag
    const setMetaTag = (attrName, attrValue, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // 2. Meta description & keywords
    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }

    // 3. OpenGraph & Twitter Titles
    if (title) {
      setMetaTag('property', 'og:title', title);
      setMetaTag('name', 'twitter:title', title);
    }

    // 4. OpenGraph & Twitter Images
    if (ogImage) {
      setMetaTag('property', 'og:image', ogImage);
      setMetaTag('name', 'twitter:image', ogImage);
    }

    // 5. OpenGraph Type
    setMetaTag('property', 'og:type', ogType);

    // 6. Canonical URL — dynamic, using window.location.origin at runtime
    const baseUrl = (typeof window !== 'undefined' ? window.location.origin : null)
      || import.meta.env.VITE_APP_URL
      || 'https://tellura.shivamgawade.dev';
    const canonicalUrl = `${baseUrl}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;
    setMetaTag('property', 'og:url', canonicalUrl);

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);
  }, [title, description, canonicalPath, ogImage, ogType]);
}

