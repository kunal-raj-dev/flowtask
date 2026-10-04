/**
 * FlowTask Dedicated Calendar CORS Proxy (Cloudflare Worker)
 * Proxies webcal / iCalendar feeds to avoid browser CORS restrictions.
 *
 * Deploy to Cloudflare Workers:
 * 1. npx wrangler deploy workers/calendar-proxy.js --name flowtask-calendar-proxy
 * 2. Configure proxy URL in FlowTask settings: https://flowtask-calendar-proxy.<subdomain>.workers.dev
 */

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing ?url= query parameter', {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain',
        },
      });
    }

    try {
      const cleanUrl = targetUrl.trim().replace(/^webcal:\/\//i, 'https://');
      const parsed = new URL(cleanUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return new Response('Invalid protocol: must be HTTP or HTTPS', {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      const upstreamResponse = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'FlowTask-Calendar-Sync/1.0 (Executive Planner)',
          'Accept': 'text/calendar, text/plain;q=0.9, */*;q=0.8',
        },
      });

      const body = await upstreamResponse.text();

      return new Response(body, {
        status: upstreamResponse.status,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        },
      });
    } catch (err) {
      return new Response(`Proxy Error: ${err.message}`, {
        status: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain',
        },
      });
    }
  },
};
