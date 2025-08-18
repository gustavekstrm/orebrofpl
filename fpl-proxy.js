// Cloudflare Worker to proxy FPL API requests
// Deploy this to Cloudflare Workers to handle CORS issues

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  const url = new URL(request.url)
  const path = url.pathname
  
  // Only allow specific FPL API endpoints
  const allowedEndpoints = [
    '/api/bootstrap-static/',
    '/api/entry/',
    '/api/leagues-classic/'
  ]
  
  const isAllowed = allowedEndpoints.some(endpoint => path.startsWith(endpoint))
  
  if (!isAllowed) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    // Construct the FPL API URL
    const fplUrl = `https://fantasy.premierleague.com${path}`
    
    // Forward the request to FPL API
    const response = await fetch(fplUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-Proxy/1.0)',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: request.method !== 'GET' ? await request.text() : undefined
    })

    // Get the response data
    const data = await response.text()
    
    // Create new response with CORS headers
    return new Response(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Proxy error',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    })
  }
}
