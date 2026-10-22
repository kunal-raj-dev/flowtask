/** Private feed proxy. Configure ALLOWED_ORIGINS and CALENDAR_HOSTS. */
export default {
  async fetch(request, env = {}) {
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin');
    const headers = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'null', 'Vary': 'Origin', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
    const fail = (status, message) => new Response(message, { status, headers });
    if (!allowed.includes(origin)) return fail(403, 'Origin is not permitted.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (request.method !== 'POST') return fail(405, 'Use POST.');
    if (!env.CALENDAR_RATE_LIMITER && !env.TEST_MODE) return fail(503, 'Calendar feed connection is not configured. Import an .ics file instead.');
    if (env.CALENDAR_RATE_LIMITER) {
      const result = await env.CALENDAR_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
      if (!result.success) return fail(429, 'Too many refreshes. Retry shortly.');
    }
    const hosts = String(env.CALENDAR_HOSTS || 'calendar.google.com,outlook.live.com,outlook.office365.com').split(',').map(s => s.trim().toLowerCase());
    try {
      if (Number(request.headers.get('Content-Length') || 0) > 4096) return fail(413, 'Request is too large.');
      const body = await request.text(); if (body.length > 4096) return fail(413, 'Request is too large.');
      const { url } = JSON.parse(body); const target = new URL(String(url).replace(/^webcal:\/\//i, 'https://'));
      if (target.protocol !== 'https:' || target.username || target.password || !hosts.includes(target.hostname.toLowerCase()) || target.port && target.port !== '443') return fail(400, 'Calendar host is not permitted.');
      const result = await fetch(target.href, { redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Accept: 'text/calendar' } });
      if (!result.ok) return fail(502, 'Calendar provider could not be reached.');
      const reader = result.body.getReader(); const chunks = []; let size = 0;
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 2 * 1024 * 1024) { await reader.cancel(); return fail(413, 'Calendar exceeds 2 MB.'); } chunks.push(part.value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const content = new TextDecoder().decode(bytes);
      if (!content.includes('BEGIN:VCALENDAR')) return fail(422, 'Provider did not return an iCalendar feed.');
      return new Response(content, { headers: { ...headers, 'Content-Type': 'text/calendar; charset=utf-8' } });
    } catch { return fail(502, 'Calendar is unavailable. Try again later.'); }
  },
};
