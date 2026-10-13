# Lambert AI chat integration

This applet is the Google AI Studio voice widget. Automobile Lambert’s public site was loading a different widget (`autoelite-widget.pages.dev`) with `AutoEliteAgent.init({ dealerId: 2 })`. That shared bundle stays in place for other dealers. Lambert’s own HTML is rewritten at the edge so this chat is the one visitors get.

## What is connected

The widget now reads dealer 2 through the same public platform routes the live widget uses:

- `GET /api/public/dealers/2` for the showroom name, address, phone, and hours
- `GET /api/public/widget-config/2` for Sophie’s name, role, and brand color
- `GET /api/ai/dealers/2/vehicles` for available stock only

Those calls are made by this app’s server (`/api/platform/context` and `/api/platform/vehicles`) so the page and the chat share one inventory. French and English phrases such as “VUS rouge” are passed to the platform search. Budget phrases such as “moins de 15 000” are translated into `maxPrice`, which the free-text search does not understand on its own.

Text answers about hours, address, and phone come from that live profile. Vehicle cards in chat come from the live search. The voice bridge still runs here, and its prompt is filled with the same inventory. Spoken replies use Kore by default, with Puck as the other choice. Greeting audio is the studio recording. Live audio is streamed through one playback graph, and each reply fades out into silence so the voice does not pop at the end.

## Live Lambert site

`dealers/automobile-richard-lambert` in NeuroDealer is the Pages source, and this environment cannot push to that private repo. The live site is updated without a new Pages deployment, so the existing Pages Functions (`/api/finance-applications` and the other `/api` routes) stay on `automobile-richard-lambert.pages.dev`.

`embed/lambert-edge.js` is a zone worker for `automobile-lambert.com` and `www.automobile-lambert.com`. It proxies every request to that Pages origin, removes the `widget-loader.js` tag and the `AutoEliteAgent.init` inline script, and serves this branch’s embed as `/lambert-chat.js`. The embed calls `api.autoelite.io` from the browser. It does not fall back to the prototype address or phone. `widget.js` on `autoelite-widget.pages.dev` is not replaced.

`npm run build:embed` writes `dist-embed/lambert-chat.js`. The published copy used by the worker is `embed/lambert-chat.js`.
