/**
 * Cloudflare Workers Reverse Proxy
 * Proxies requests from workers.dev to the Vercel deployment.
 * This allows users in China to access the site without a VPN.
 */

const TARGET_HOST = "taoybeats-clone.vercel.app"
const TARGET_ORIGIN = `https://${TARGET_HOST}`

const worker = {
  async fetch(request, _env, _ctx) {
    const url = new URL(request.url)

    // Build target URL preserving path and query
    const targetUrl = new URL(url.pathname + url.search, TARGET_ORIGIN)

    // Clone headers and update Host
    const headers = new Headers(request.headers)
    headers.set("Host", TARGET_HOST)

    // Remove CF-specific headers that might confuse the origin
    headers.delete("cf-connecting-ip")
    headers.delete("cf-ray")
    headers.delete("cf-visitor")
    headers.delete("cf-worker")

    // Forward the request
    const modifiedRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    })

    let response
    try {
      response = await fetch(modifiedRequest)
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, {
        status: 502,
        headers: { "Content-Type": "text/plain" },
      })
    }

    // Clone response so we can modify headers
    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })

    // Security / cache headers
    modifiedResponse.headers.set("X-Proxied-By", "cloudflare-workers")
    modifiedResponse.headers.delete("x-vercel-cache")
    modifiedResponse.headers.delete("x-vercel-id")

    return modifiedResponse
  },
}

export default worker
