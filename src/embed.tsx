import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import widgetCss from './index.css?inline';
import { ChatWidget } from './components/ChatWidget';
import { DealerProvider } from './dealerContext';
import { DealerProfile } from './dealerPlatform';
import { loadDealerContext } from './portalApi';

function EmbedRoot() {
  const [dealer, setDealer] = useState<DealerProfile | null>(null);

  useEffect(() => {
    loadDealerContext().then(setDealer).catch(() => setDealer(null));
  }, []);

  if (!dealer) return null;

  return (
    <DealerProvider dealer={dealer}>
      <ChatWidget />
    </DealerProvider>
  );
}

function mountLambertChat() {
  if (document.getElementById('lambert-studio-chat')) return;

  const host = document.createElement('div');
  host.id = 'lambert-studio-chat';
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.zIndex = '2147483000';
  host.style.pointerEvents = 'none';

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = widgetCss;
  const mount = document.createElement('div');
  mount.style.pointerEvents = 'auto';
  shadow.append(style, mount);
  document.body.appendChild(host);
  createRoot(mount).render(<EmbedRoot />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountLambertChat);
} else {
  mountLambertChat();
}
