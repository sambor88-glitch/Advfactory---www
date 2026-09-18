import type { APIRoute } from 'astro';
import { pobierzOferte, kierunkiOpublikowane } from '../data/oferta';
import { svgMapy } from '../lib/mapa';

export const GET: APIRoute = async () => {
  const oferta = await pobierzOferte();
  return new Response(svgMapy(kierunkiOpublikowane(oferta)), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // Plik zmienia się tylko przy publikacji oferty, a wtedy i tak leci
      // przebudowa i inwalidacja CloudFrontu.
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
};
