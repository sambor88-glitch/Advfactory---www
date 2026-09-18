// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Strona jest w pełni statyczna (SSG). Oferta wchodzi w build jako dane,
// a w przeglądarce dociąga się z tego samego CloudFrontu pod /data/oferta.json.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://advfactory.com',
  output: 'static',
  // Sitemapa jest potrzebna nie tylko pod indeksację — przy przełączeniu
  // z WordPressa będzie punktem odniesienia dla mapy przekierowań 301.
  integrations: [
    sitemap({
      // Poza indeksem: panel za logowaniem i strony bez wartości w wyszukiwarce
      // (potwierdzenie wysyłki zapytania).
      filter: (url) => !/\/(panel|dziekujemy)\/?$/.test(url),
    }),
  ],
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  vite: {
    // docs/ leży obok web/ — Vite musi mieć prawo czytać z katalogu wyżej.
    server: { fs: { allow: ['..'] } },
  },
});
