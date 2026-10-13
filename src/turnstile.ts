/**
 * Invisible Turnstile for the dealer chat.
 * Site key is public. The secret stays on api.autoelite.io, which calls siteverify.
 * Widget "AutoElite API Protection" (invisible) is already bound to
 * automobile-lambert.com and www.automobile-lambert.com.
 */

export const TURNSTILE_SITE_KEY = '0x4AAAAAAC-sNK5oL6YqhMUs';
export const TURNSTILE_ACTION = 'voice';

type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  execution: 'execute';
  appearance: 'execute';
  retry: 'never';
  callback: (token: string) => void;
  'error-callback': () => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Waiter = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
  timer: number;
};

let scriptPromise: Promise<void> | null = null;
let widgetId: string | undefined;
let renderedHost: HTMLElement | null = null;
let pending: Waiter | null = null;

function failPending(message: string): void {
  const waiter = pending;
  if (!waiter) return;
  pending = null;
  window.clearTimeout(waiter.timer);
  waiter.reject(new Error(message));
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Turnstile needs a browser'));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const finish = () => {
      if (window.turnstile) resolve();
      else reject(new Error('Turnstile did not load'));
    };
    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      existing.addEventListener('load', finish);
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed')));
      window.setTimeout(finish, 0);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => finish();
    script.onerror = () => reject(new Error('Turnstile script failed'));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

/** Render the invisible widget once inside the chat shadow root. */
export async function prepareTurnstile(host: HTMLElement): Promise<void> {
  await loadTurnstileScript();
  const api = window.turnstile;
  if (!api) throw new Error('Turnstile did not load');
  if (widgetId && renderedHost === host && host.isConnected) return;
  if (widgetId) {
    try { api.remove(widgetId); } catch { /* widget already removed with the panel */ }
    widgetId = undefined;
    renderedHost = null;
  }
  host.replaceChildren();
  const slot = document.createElement('div');
  host.appendChild(slot);
  widgetId = api.render(slot, {
    sitekey: TURNSTILE_SITE_KEY,
    action: TURNSTILE_ACTION,
    execution: 'execute',
    appearance: 'execute',
    retry: 'never',
    callback: (token: string) => {
      const waiter = pending;
      if (!waiter) return;
      pending = null;
      window.clearTimeout(waiter.timer);
      if (typeof token === 'string' && token.length > 0) waiter.resolve(token);
      else waiter.reject(new Error('Turnstile returned an empty token'));
    },
    'error-callback': () => failPending('Turnstile challenge failed'),
    'expired-callback': () => failPending('Turnstile token expired'),
    'timeout-callback': () => failPending('Turnstile challenge timed out'),
  });
  renderedHost = host;
}

/** Fresh single-use token. The caller must reset after the platform redeems it. */
export async function obtainTurnstileToken(host: HTMLElement): Promise<string> {
  failPending('Turnstile superseded');
  await prepareTurnstile(host);
  const api = window.turnstile;
  if (!api || !widgetId) throw new Error('Turnstile widget missing');
  const id = widgetId;
  try { api.reset(id); } catch { /* first execute has nothing to reset */ }
  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => failPending('Turnstile timed out'), 12000);
    pending = { resolve, reject, timer };
    try {
      api.execute(id);
    } catch (error) {
      failPending(error instanceof Error ? error.message : 'Turnstile execute failed');
    }
  });
}

/** Arm the widget for the next mic reply. Tokens are single-use. */
export function resetTurnstileWidget(): void {
  const api = window.turnstile;
  if (!api || !widgetId) return;
  try { api.reset(widgetId); } catch { /* widget was removed with the panel */ }
}
