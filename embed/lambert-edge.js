const SOURCE_COMMIT = "eb19528cc05425bcaf96f0833f30403aad91d203";
const SOURCE_ROOT = `https://raw.githubusercontent.com/NeuroDivers/ai-studio---chat-widget---autoelite/${SOURCE_COMMIT}`;
const CHAT_URL = `${SOURCE_ROOT}/embed/lambert-chat.js`;
const ORIGIN = "https://automobile-richard-lambert.pages.dev";
const GREETING_FILE = /^greeting-(?:en|fr|kore-en|kore-fr|puck-en)\.wav$/;
const FAVICON_TYPES = {
  "/favicon.ico": "image/x-icon",
  "/favicon-32.png": "image/png",
  "/apple-touch-icon.png": "image/png",
  "/icon-192.png": "image/png",
};

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

function rewriteIconTag(tag) {
  const rel = /rel=["']([^"']+)["']/i.exec(tag);
  if (!rel) return tag;
  const relVal = rel[1].toLowerCase();
  if (relVal === "apple-touch-icon" || relVal === "apple-touch-icon-precomposed") {
    return tag.replace(/href=["'][^"']*["']/i, 'href="/apple-touch-icon.png"');
  }
  if (relVal !== "icon" && relVal !== "shortcut icon") return tag;
  const href = /href=["']([^"']*)["']/i.exec(tag);
  if (href && (href[1] === "/favicon-32.png" || href[1] === "/icon-192.png")) return tag;
  if (href) return tag.replace(/href=["'][^"']*["']/i, 'href="/favicon.ico"');
  return tag.replace(/<link\b/i, '<link href="/favicon.ico"');
}

function ensureHeadTags(html, tags) {
  if (!tags.length) return html;
  const block = tags.join("");
  if (html.includes("</head>")) return html.replace("</head>", `${block}</head>`);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (head) => `${head}${block}`);
  return `${block}${html}`;
}

export function rewriteHtml(html) {
  let out = html.replace(
    /<script\b[^>]*src=["'][^"']*(?:widget-loader\.js|autoelite-widget\.pages\.dev)[^"']*["'][^>]*>\s*<\/script>/gi,
    "",
  );
  out = out.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?AutoEliteAgent[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<link\b[^>]*>/gi, rewriteIconTag);
  const tags = [];
  const hasIco =
    /rel=["'](?:shortcut icon|icon)["'][^>]*href=["']\/favicon\.ico["']/i.test(out) ||
    /href=["']\/favicon\.ico["'][^>]*rel=["'](?:shortcut icon|icon)["']/i.test(out);
  if (!hasIco) tags.push('<link rel="icon" href="/favicon.ico"/>');
  if (!out.includes('href="/favicon-32.png"')) {
    tags.push('<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"/>');
  }
  if (!/rel=["']apple-touch-icon["']/i.test(out)) {
    tags.push('<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>');
  }
  if (!out.includes('href="/icon-192.png"')) {
    tags.push('<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png"/>');
  }
  out = ensureHeadTags(out, tags);
  if (!out.includes("/lambert-chat.js")) {
    const tag = '<script src="/lambert-chat.js" defer></script>';
    out = out.includes("</body>") ? out.replace("</body>", `${tag}</body>`) : `${out}${tag}`;
  }
  return out;
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const faviconType = FAVICON_TYPES[incoming.pathname];
    if (faviconType && (request.method === "GET" || request.method === "HEAD")) {
      const fileName = incoming.pathname.slice(1);
      const assetUrl = `${SOURCE_ROOT}/public/favicon/${fileName}`;
      try {
        const cache = caches.default;
        const cached = await cache.match(assetUrl);
        const upstream = cached || await fetch(assetUrl, { headers: { "User-Agent": "lambert-studio-chat" } });
        if (!upstream.ok) {
          return new Response("Favicon unavailable", {
            status: 502,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
        const bytes = await upstream.arrayBuffer();
        const headers = {
          "content-type": faviconType,
          "cache-control": "public, max-age=300",
          "content-length": String(bytes.byteLength),
          "x-content-type-options": "nosniff",
        };
        if (!cached) {
          await cache.put(assetUrl, new Response(bytes, { headers }));
        }
        return new Response(request.method === "HEAD" ? null : bytes, { headers });
      } catch (error) {
        return new Response(String(error && error.message ? error.message : error), {
          status: 502,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
    }

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
          "cache-control": "public, max-age=300",
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
