import React from 'react';
import { Vehicle } from '../types/inventory';
import { useDealer } from '../dealerContext';
import { stockLabel } from '../dealerPlatform';
import { formatCadPrice, formatMileage } from './VehicleCard';
import { ArrowLeft, Gauge, Tag, Zap, Cog, Fuel, Compass, Calendar, Phone, CheckCircle2 } from 'lucide-react';

interface VehicleDetailViewProps {
  vehicle: Vehicle;
  onBack: () => void;
  onRequestInfo?: (vehicle: Vehicle) => void;
}

export const VehicleDetailView: React.FC<VehicleDetailViewProps> = ({
  vehicle,
  onBack,
  onRequestInfo,
}) => {
  const dealer = useDealer();
  return (
    <div className="absolute inset-0 bg-white z-20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header bar */}
      <div className="p-3.5 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-[#991b1e] transition-colors py-1 px-2 rounded-lg hover:bg-gray-100"
          aria-label="Retour"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux messages</span>
        </button>
        <span className="text-xs font-medium text-gray-500">
          {stockLabel(vehicle)}
        </span>
      </div>

      {/* Scrollable details body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left">
        {/* Large 4:3 Photo Area */}
        <div className="relative aspect-[4/3] w-full rounded-xl bg-gray-200 overflow-hidden shadow-inner">
          {vehicle.photo ? (
            <img
              src={vehicle.photo}
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium text-sm">
              Photo à venir
            </div>
          )}

          {/* Year Badge */}
          <div className="absolute top-3 left-3 bg-[#991b1e] text-white font-bold text-sm px-3 py-1 rounded shadow">
            {vehicle.year}
          </div>

          <div className="absolute top-3 right-3 bg-emerald-600 text-white font-semibold text-xs px-2.5 py-1 rounded shadow uppercase tracking-wider">
            Disponible
          </div>
        </div>

        {/* Title & Price */}
        <div className="border-b border-gray-100 pb-3">
          <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            {vehicle.body_label || vehicle.body_style}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-0.5 leading-snug">
            {vehicle.make} {vehicle.model}{' '}
            <span className="text-gray-600 font-medium text-lg">{vehicle.trim}</span>
          </h2>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#991b1e]">
              {formatCadPrice(vehicle.price)}
            </span>
            <span className="text-xs text-gray-500">CAD + taxes applicables</span>
          </div>
        </div>

        {/* Core Specs Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-2.5">
            <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-gray-400" />
              Kilométrage
            </div>
            <div className="text-sm font-bold text-gray-900 mt-0.5">
              {formatMileage(vehicle.mileage)}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-2.5">
            <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-gray-400" />
              Traction (Drivetrain)
            </div>
            <div className="text-sm font-bold text-gray-900 mt-0.5 uppercase">
              {vehicle.drivetrain}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-2.5">
            <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <Cog className="w-3.5 h-3.5 text-gray-400" />
              Transmission
            </div>
            <div className="text-sm font-bold text-gray-900 mt-0.5 capitalize">
              {vehicle.transmission}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-2.5">
            <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-gray-400" />
              Carburant
            </div>
            <div className="text-sm font-bold text-gray-900 mt-0.5 capitalize">
              {vehicle.fuel_type}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-2.5">
            <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-gray-400" />
              Couleur extérieure
            </div>
            <div className="text-sm font-bold text-gray-900 mt-0.5 capitalize">
              {vehicle.exterior_color}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-2.5">
            <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-gray-400" />
              Numéro de stock
            </div>
            <div className="text-sm font-bold text-gray-900 mt-0.5">
              {stockLabel(vehicle)}
            </div>
          </div>
        </div>

        {/* Vehicle Description */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-1.5">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Description du véhicule
          </h4>
          <p className="text-xs text-gray-700 leading-relaxed">
            {vehicle.description ||
              `${[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')}. Véhicule disponible immédiatement chez ${dealer.name}.`}
          </p>
        </div>

        {/* Guarantees */}
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1.5 text-xs text-gray-700">
          <div className="flex items-center gap-2 font-medium text-gray-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            Inspection certifiée 150 points complétée
          </div>
          <div className="flex items-center gap-2 font-medium text-gray-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            Rapport d'historique CARFAX disponible sans frais
          </div>
        </div>

        {/* Call to action buttons */}
        <div className="pt-2 space-y-2">
          <button
            onClick={() => onRequestInfo?.(vehicle)}
            className="w-full bg-[#991b1e] hover:bg-[#801618] active:bg-[#6b1214] text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Calendar className="w-4 h-4" />
            <span>Réserver un essai routier</span>
          </button>
          
          <a
            href={dealer.phoneHref}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs"
          >
            <Phone className="w-3.5 h-3.5 text-gray-600" />
            <span>Appeler le concessionnaire : {dealer.phone}</span>
          </a>
        </div>
      </div>
    </div>
  );
};
