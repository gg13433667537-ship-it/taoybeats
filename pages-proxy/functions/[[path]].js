export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const targetUrl = new URL(url.pathname + url.search, "https://taoybeats-clone.vercel.app");
  
  const headers = new Headers(request.headers);
  headers.set("Host", "taoybeats-clone.vercel.app");
  
  const modifiedRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });

  try {
    const response = await fetch(modifiedRequest);
    const newHeaders = new Headers(response.headers);
    newHeaders.set("X-Proxied-By", "cf-pages-function");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (err) {
    return new Response("Proxy error: " + err.message, { status: 502 });
  }
}
