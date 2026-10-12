# Lambert AI chat integration

This applet is the Google AI Studio voice widget. Automobile Lambert’s public site already loads a different widget (`autoelite-widget.pages.dev`) with `AutoEliteAgent.init({ dealerId: 2 })`. That production bundle is owned by the dealer repo. This branch does not replace it.

## What is connected

The widget now reads dealer 2 through the same public platform routes the live widget uses:

- `GET /api/public/dealers/2` for the showroom name, address, phone, and hours
- `GET /api/public/widget-config/2` for Sophie’s name, role, and brand color
- `GET /api/ai/dealers/2/vehicles` for available stock only

Those calls are made by this app’s server (`/api/platform/context` and `/api/platform/vehicles`) so the page and the chat share one inventory. French and English phrases such as “VUS rouge” are passed to the platform search. Budget phrases such as “moins de 15 000” are translated into `maxPrice`, which the free-text search does not understand on its own.

Text answers about hours, address, and phone come from that live profile. Vehicle cards in chat come from the live search. The voice bridge still runs here, and its prompt is filled with the same inventory.

## What stays on the dealer site

`POST /api/ai-proxy/gemini` and `POST /api/ai-proxy/gemini-live?ephemeral=1` require the dealer site’s bot check. They should keep being called from `automobile-lambert.com`, where Turnstile already runs. This applet does not send a fake token and does not publish a new `widget-loader.js`.

## Next step for the dealer repo

When the other widget work is ready to take this UI, point the dealer bundle at this chat and keep minting the ephemeral Live token in the browser on the dealer origin. Leave `widget-loader.js` in place until that bundle is the one Lambert should load.
