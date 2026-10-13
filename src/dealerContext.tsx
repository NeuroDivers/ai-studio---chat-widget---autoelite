import React, { createContext, useContext } from 'react';
import { DealerProfile } from './dealerPlatform';

const EMPTY_DEALER: DealerProfile = {
  id: 2,
  name: 'Automobile Lambert',
  phone: '',
  phoneHref: '',
  email: '',
  addressLine: '',
  hoursSummary: '',
  hoursToday: '',
  about: '',
  primaryColor: '#991b1e',
  agentName: 'Sophie',
  agentRole: 'Conseillère Automobile',
  websiteUrl: 'https://automobile-lambert.com',
  source: 'autoelite',
};

const DealerContext = createContext<DealerProfile>(EMPTY_DEALER);

export function DealerProvider({
  dealer,
  children,
}: {
  dealer: DealerProfile;
  children: React.ReactNode;
}) {
  return <DealerContext.Provider value={dealer}>{children}</DealerContext.Provider>;
}

export function useDealer(): DealerProfile {
  return useContext(DealerContext);
}
