import React, { createContext, useContext } from 'react';
import { DealerProfile, PROTOTYPE_DEALER } from './dealerPlatform';

const DealerContext = createContext<DealerProfile>(PROTOTYPE_DEALER);

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
