function getCloudflareData(request) {
  const cf = request.cf || {}
  const clientIp = request.headers.get('CF-Connecting-IP') || ''

  return {
    ip: clientIp,
    ipCountry: request.headers.get('CF-IPCountry') || undefined,
    country: cf.country,
    region: cf.region,
    regionCode: cf.regionCode,
    city: cf.city,
    postalCode: cf.postalCode,
    timezone: cf.timezone,
    latitude: cf.latitude,
    longitude: cf.longitude,
    continent: cf.continent,
    colo: cf.colo,
    asn: cf.asn,
    asOrganization: cf.asOrganization
  }
}

function setHeaderIfPresent(headers, headerName, value) {
  if (value !== undefined && value !== null && value !== '') {
    headers.set(headerName, String(value))
  }
}

function setCloudflareHeaders(headers, cfData) {
  if (cfData.ip) {
    headers.set('X-Real-IP', cfData.ip)
    headers.set('X-Forwarded-For', cfData.ip)
  }

  for (const [headerName, value] of Object.entries({
    'X-CF-IPCountry': cfData.ipCountry,
    'X-CF-Country': cfData.country,
    'X-CF-Region-Code': cfData.regionCode,
    'X-CF-Postal-Code': cfData.postalCode,
    'X-CF-Timezone': cfData.timezone,
    'X-CF-Latitude': cfData.latitude,
    'X-CF-Longitude': cfData.longitude,
    'X-CF-Continent': cfData.continent,
    'X-CF-Colo': cfData.colo,
    'X-CF-ASN': cfData.asn
  })) {
    setHeaderIfPresent(headers, headerName, value)
  }
}

async function logUserByCloudflare(targetUrl, incomingPathname, cfData) {
  if (!incomingPathname.includes('/app/user/info')) {
    return
  }

  const logUrl = new URL(targetUrl)
  logUrl.pathname = '/app/userLogByCF'
  logUrl.search = ''

  const response = await fetch(logUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ cf: cfData })
  })

  console.log('userLogByCFIP', await response.text())
}

export default {
  async fetch(request, env, ctx) {
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

    const cfData = getCloudflareData(request)
    setCloudflareHeaders(headers, cfData)
    ctx.waitUntil(logUserByCloudflare(targetUrl, incomingUrl.pathname, cfData))

    let body = request.body
    const contentType = request.headers.get('Content-Type') || ''
    const canHaveBody = !['GET', 'HEAD'].includes(request.method)
    const isJsonRequest = contentType.toLowerCase().includes('application/json')

    if (canHaveBody && isJsonRequest) {
      const originalBody = await request.clone().json().catch(() => undefined)

      if (originalBody && typeof originalBody === 'object' && !Array.isArray(originalBody)) {
        headers.delete('Content-Length')
        headers.set('Content-Type', 'application/json')
        body = JSON.stringify({
          ...originalBody,
          cf: cfData
        })
      }
    }

    return fetch(new Request(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'manual'
    }))
  }
}
