const CHAT_B64 = "__CHAT_B64__";
const ORIGIN = "https://automobile-richard-lambert.pages.dev";

let chatBytes;

function chatBody() {
  if (!chatBytes) {
    const binary = atob(CHAT_B64);
    chatBytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      chatBytes[index] = binary.charCodeAt(index);
    }
  }
  return chatBytes;
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
    if (incoming.pathname === "/lambert-chat.js") {
      return new Response(chatBody(), {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=300",
          "x-content-type-options": "nosniff",
        },
      });
    }

    const originUrl = new URL(`${incoming.pathname}${incoming.search}`, ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete("host");
    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }
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
