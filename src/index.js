export default {
  async fetch(request, env) {
    const incomingUrl = new URL(request.url)

    if (!incomingUrl.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 })
    }

    const backendOrigin = env.BACKEND_ORIGIN
    if (!backendOrigin) {
      return new Response('BACKEND_ORIGIN is not configured', { status: 500 })
    }

    const targetUrl = new URL(backendOrigin)
    const shouldStripApiPrefix = String(env.STRIP_API_PREFIX ?? 'true') === 'true'

    targetUrl.pathname = shouldStripApiPrefix
      ? incomingUrl.pathname.replace(/^\/api/, '') || '/'
      : incomingUrl.pathname
    targetUrl.search = incomingUrl.search

    const headers = new Headers(request.headers)
    headers.set('Host', targetUrl.hostname)
    headers.set('X-Forwarded-Host', incomingUrl.hostname)
    headers.set('X-Original-Host', incomingUrl.hostname)
    headers.set('X-Forwarded-Proto', incomingUrl.protocol.replace(':', ''))

    const cf = request.cf || {}
    const clientIp = request.headers.get('CF-Connecting-IP') || ''

    if (clientIp) {
      headers.set('X-Real-IP', clientIp)
      headers.set('X-Forwarded-For', clientIp)
    }

    for (const [headerName, value] of Object.entries({
      'X-CF-IPCountry': request.headers.get('CF-IPCountry'),
      'X-CF-Country': cf.country,
      'X-CF-Region': cf.region,
      'X-CF-Region-Code': cf.regionCode,
      'X-CF-City': cf.city,
      'X-CF-Postal-Code': cf.postalCode,
      'X-CF-Timezone': cf.timezone,
      'X-CF-Latitude': cf.latitude,
      'X-CF-Longitude': cf.longitude,
      'X-CF-Continent': cf.continent,
      'X-CF-Colo': cf.colo,
      'X-CF-ASN': cf.asn,
      'X-CF-AS-Organization': cf.asOrganization
    })) {
      if (value !== undefined && value !== null && value !== '') {
        headers.set(headerName, String(value))
      }
    }

    return fetch(new Request(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual'
    }))
  }
}
