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

    return fetch(new Request(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual'
    }))
  }
}
