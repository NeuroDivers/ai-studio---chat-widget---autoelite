const SOURCE_COMMIT = "a9567bb1abbee7db059461876685c91e753e7139";
const SOURCE_ROOT = `https://raw.githubusercontent.com/NeuroDivers/ai-studio---chat-widget---autoelite/${SOURCE_COMMIT}`;
const CHAT_URL = `${SOURCE_ROOT}/embed/lambert-chat.js`;
const ORIGIN = "https://automobile-richard-lambert.pages.dev";
const GREETING_FILE = /^greeting-(?:en|fr|kore-en|kore-fr|puck-en)\.wav$/;

async function chatBody() {
  const cache = caches.default;
  const cached = await cache.match(CHAT_URL);
  if (cached) return cached.arrayBuffer();
  const upstream = await fetch(CHAT_URL, {
    headers: { "User-Agent": "lambert-studio-chat", Accept: "text/javascript" },
  });
  if (!upstream.ok) {
    const detail = await upstream.text();
    throw new Error(`chat bundle ${upstream.status} ${detail.slice(0, 180)}`);
  }
  const bytes = await upstream.arrayBuffer();
  const stored = new Response(bytes, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
  await cache.put(CHAT_URL, stored.clone());
  return bytes;
}

function rewriteHtml(html) {
  let out = html.replace(
    /<script\b[^>]*src=["'][^"']*(?:widget-loader\.js|autoelite-widget\.pages\.dev)[^"']*["'][^>]*>\s*<\/script>/gi,
    "",
  );
  out = out.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?AutoEliteAgent[\s\S]*?<\/script>/gi, "");
  if (!out.includes("/lambert-chat.js")) {
    const tag = '<script src="/lambert-chat.js" defer></script>';
    out = out.includes("</body>") ? out.replace("</body>", `${tag}</body>`) : `${out}${tag}`;
  }
  return out;
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.pathname.startsWith("/audio/")) {
      const fileName = incoming.pathname.slice("/audio/".length);
      if (!GREETING_FILE.test(fileName)) {
        return new Response("Not found", { status: 404 });
      }
      try {
        const audioUrl = `${SOURCE_ROOT}/public/audio/${fileName}`;
        const cache = caches.default;
        const cached = await cache.match(audioUrl);
        const upstream = cached || await fetch(audioUrl, { headers: { "User-Agent": "lambert-studio-chat" } });
        if (!upstream.ok) {
          return new Response("Greeting audio unavailable", { status: 502 });
        }
        const bytes = await upstream.arrayBuffer();
        const headers = {
          "content-type": "audio/wav",
          "cache-control": "public, max-age=86400",
        };
        if (!cached) {
          await cache.put(audioUrl, new Response(bytes, { headers }));
        }
        return new Response(bytes, { headers });
      } catch (error) {
        return new Response(String(error && error.message ? error.message : error), { status: 502 });
      }
    }

    if (incoming.pathname === "/lambert-chat.js") {
      try {
        const bytes = await chatBody();
        return new Response(bytes, {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "public, max-age=300",
            "x-content-type-options": "nosniff",
          },
        });
      } catch (error) {
        return new Response(String(error && error.message ? error.message : error), {
          status: 502,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
    }

    const originUrl = new URL(`${incoming.pathname}${incoming.search}`, ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete("host");
    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;
    const response = await fetch(originUrl, init);
    const type = response.headers.get("content-type") || "";
    if ((request.method !== "GET" && request.method !== "HEAD") || !type.includes("text/html")) {
      return response;
    }

    const html = await response.text();
    const nextHeaders = new Headers(response.headers);
    nextHeaders.delete("content-length");
    nextHeaders.delete("content-encoding");
    return new Response(rewriteHtml(html), {
      status: response.status,
      statusText: response.statusText,
      headers: nextHeaders,
    });
  },
};
