import React, { useState, useEffect } from 'react';
import { DealerInventoryPage } from './components/DealerInventoryPage';
import { ChatWidget } from './components/ChatWidget';
import { VehicleDetailView } from './components/VehicleDetailView';
import { Vehicle } from './types/inventory';
import { DealerProfile } from './dealerPlatform';
import { DealerProvider } from './dealerContext';
import { loadDealerContext, loadInventory } from './portalApi';

export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [inventorySource, setInventorySource] = useState<'loading' | 'autoelite' | 'prototype'>('loading');
  const [selectedPageVehicle, setSelectedPageVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    loadDealerContext().then(setDealer);
    loadInventory('').then((loaded) => {
      setVehicles(loaded.vehicles);
      setInventorySource(loaded.source);
    });
  }, []);

  if (!dealer) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] text-gray-600 grid place-items-center">
        Chargement d'Automobile Richard Lambert…
      </div>
    );
  }

  return (
    <DealerProvider dealer={dealer}>
    <div className="min-h-screen bg-[#f3f4f6] relative">
      {/* Lambert storefront backed by the live dealer inventory */}
      <DealerInventoryPage
        vehicles={vehicles}
        inventorySource={inventorySource}
        onSelectVehicle={(vehicle) => setSelectedPageVehicle(vehicle)}
      />

      {/* Floating Chat Widget */}
      <ChatWidget />

      {/* Page-level vehicle detail preview modal if clicked from inventory grid */}
      {selectedPageVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg h-[640px] max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
            <VehicleDetailView
              vehicle={selectedPageVehicle}
              onBack={() => setSelectedPageVehicle(null)}
              onRequestInfo={(v) => {
                setSelectedPageVehicle(null);
                // The floating widget can be used to chat
              }}
            />
          </div>
        </div>
      )}
    </div>
    </DealerProvider>
  );
}
