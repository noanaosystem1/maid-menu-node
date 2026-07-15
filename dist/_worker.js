// Minimal Cloudflare Worker solely used for admin authentication / proxy checks.
// Handles POST /api/admin/login validation and simple public OPTIONS request routing.

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password, Authorization",
      "Access-Control-Max-Age": "86400",
      "Content-Type": "application/json",
    },
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password, Authorization",
  "Access-Control-Max-Age": "86400",
};

function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Static Assets fallback
    if (!path.startsWith("/api")) {
      if (env.ASSETS) {
        let response = await env.ASSETS.fetch(request);
        if (response.status === 404) {
          response = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
        }
        return response;
      }
      return new Response("Not Found", { status: 404 });
    }

    // POST /api/admin/login
    if (path === "/api/admin/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const { password } = body;
        const expectedPassword = env.ADMIN_PASSWORD || "maid2024";

        if (password === expectedPassword) {
          return jsonResponse({ success: true, token: expectedPassword });
        } else {
          return jsonResponse({ error: "Unauthorized access" }, 401);
        }
      } catch (err) {
        return jsonResponse({ error: "Bad request" }, 400);
      }
    }

    return jsonResponse({ error: "Not Found on Auth Proxy Worker" }, 404);
  }
};
