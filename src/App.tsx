import React, { useState, useEffect } from 'react';
import { DealerInventoryPage } from './components/DealerInventoryPage';
import { ChatWidget } from './components/ChatWidget';
import { VehicleDetailView } from './components/VehicleDetailView';
import { Vehicle, INVENTORY_PROTOTYPE } from './types/inventory';
import { loadVehicles } from './portalApi';

export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(INVENTORY_PROTOTYPE);
  const [selectedPageVehicle, setSelectedPageVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    // Load available inventory using portal hook
    loadVehicles('').then((loaded) => {
      setVehicles(loaded);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#f3f4f6] relative">
      {/* Sample Dealer Inventory Page */}
      <DealerInventoryPage
        vehicles={vehicles}
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
  );
}
