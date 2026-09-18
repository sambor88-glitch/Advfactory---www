// @ts-check
import { defineConfig } from 'astro/config';

// Strona jest w pełni statyczna (SSG). Oferta wchodzi w build jako dane,
// a w przeglądarce dociąga się z tego samego CloudFrontu pod /data/oferta.json.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://advfactory.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  vite: {
    // docs/ leży obok web/ — Vite musi mieć prawo czytać z katalogu wyżej.
    server: { fs: { allow: ['..'] } },
  },
});
