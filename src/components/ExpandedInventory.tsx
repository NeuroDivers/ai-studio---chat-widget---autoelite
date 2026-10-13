import React from 'react';
import { Vehicle } from '../types/inventory';
import { TestDriveLeadDraft, TestDriveLeadResult } from '../testDriveLead';
import { VehicleCard } from './VehicleCard';
import { VehicleDetailView } from './VehicleDetailView';

interface ExpandedInventoryProps {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  language: 'fr' | 'en';
  resultsLabel: string;
  onSelect: (vehicle: Vehicle) => void;
  onBack: () => void;
  onSubmitTestDrive?: (draft: TestDriveLeadDraft) => Promise<TestDriveLeadResult>;
}

function ResultGrid({
  vehicles,
  selectedVehicle,
  language,
  resultsLabel,
  onSelect,
  rows = false,
}: Omit<ExpandedInventoryProps, 'onBack' | 'onSubmitTestDrive'> & { rows?: boolean }) {
  return (
    <>
      <div className="shrink-0 px-3 pt-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {resultsLabel}
      </div>
      <div className={`lambert-results min-h-0 flex-1 overflow-y-auto ${rows ? 'p-2' : 'p-3'}`} data-lambert-results="">
        <div className="lambert-vehicle-grid" data-lambert-grid="">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              dense={!rows}
              row={rows}
              language={language}
              selected={selectedVehicle?.id === vehicle.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/** Full-view inventory: a reflowing card grid, or a list beside the detail pane. */
export const ExpandedInventory: React.FC<ExpandedInventoryProps> = ({
  vehicles,
  selectedVehicle,
  language,
  resultsLabel,
  onSelect,
  onBack,
  onSubmitTestDrive,
}) => {
  if (!selectedVehicle) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50" data-lambert-stage="grid">
        <ResultGrid
          vehicles={vehicles}
          selectedVehicle={selectedVehicle}
          language={language}
          resultsLabel={resultsLabel}
          onSelect={onSelect}
        />
      </div>
    );
  }

  return (
    <div className="lambert-split bg-gray-50" data-lambert-stage="detail">
      <div className="lambert-split-list">
        <ResultGrid
          vehicles={vehicles}
          selectedVehicle={selectedVehicle}
          language={language}
          resultsLabel={resultsLabel}
          onSelect={onSelect}
          rows
        />
      </div>
      <div className="lambert-split-detail">
        <VehicleDetailView
          vehicle={selectedVehicle}
          language={language}
          layout="pane"
          onBack={onBack}
          onSubmitTestDrive={onSubmitTestDrive}
        />
      </div>
    </div>
  );
};
