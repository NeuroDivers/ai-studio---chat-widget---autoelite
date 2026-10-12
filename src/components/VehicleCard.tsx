import React from 'react';
import { Vehicle } from '../types/inventory';
import { stockLabel } from '../dealerPlatform';
import { Gauge, Tag, ChevronRight } from 'lucide-react';

interface VehicleCardProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle) => void;
  compact?: boolean;
}

export function formatCadPrice(price: number): string {
  return price.toLocaleString('fr-CA') + ' $';
}

export function formatMileage(km: number): string {
  return km.toLocaleString('fr-CA') + ' km';
}

export const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onSelect, compact = false }) => {
  return (
    <div
      onClick={() => onSelect(vehicle)}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col group text-left"
    >
      {/* 4:3 Photo Area */}
      <div className="relative aspect-[4/3] w-full bg-gray-200 overflow-hidden flex items-center justify-center">
        {vehicle.photo ? (
          <img
            src={vehicle.photo}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center text-gray-500">
            <span className="text-xs font-medium tracking-wide uppercase">Photo à venir</span>
          </div>
        )}

        {/* Year badge: White text on dealer red */}
        <div className="absolute top-2.5 left-2.5 bg-[#991b1e] text-white font-bold text-xs px-2.5 py-1 rounded shadow-md">
          {vehicle.year}
        </div>

        {/* Status indicator badge */}
        <div className="absolute top-2.5 right-2.5 bg-emerald-600/95 text-white text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded shadow-sm">
          Disponible
        </div>
      </div>

      {/* Card Content */}
      <div className={`p-3.5 flex flex-col justify-between flex-1 ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
        <div>
          {/* Make, Model, Trim */}
          <h4 className="text-base font-bold text-gray-900 group-hover:text-[#991b1e] transition-colors leading-tight">
            {vehicle.make} {vehicle.model}{' '}
            <span className="text-gray-600 font-medium text-sm">{vehicle.trim}</span>
          </h4>

          {/* Quick specs pill row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-gray-600">
            <span className="bg-gray-100 px-2 py-0.5 rounded font-medium text-gray-800">
              {vehicle.body_label || vehicle.body_style}
            </span>
            {vehicle.drivetrain && (
            <span className="bg-gray-100 px-2 py-0.5 rounded font-medium text-gray-800">
              {vehicle.drivetrain}
            </span>
            )}
            <span className="bg-gray-100 px-2 py-0.5 rounded capitalize text-gray-700">
              {vehicle.exterior_color}
            </span>
          </div>
        </div>

        {/* Price & Mileage & Stock */}
        <div className="pt-2 border-t border-gray-100 flex items-end justify-between">
          <div>
            <div className="text-lg font-black text-[#991b1e]">
              {formatCadPrice(vehicle.price)}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
              <span className="flex items-center gap-1">
                <Gauge className="w-3 h-3 text-gray-500" />
                {formatMileage(vehicle.mileage)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-gray-500" />
                {stockLabel(vehicle)}
              </span>
            </div>
          </div>

          <div className="text-gray-400 group-hover:text-[#991b1e] transition-colors p-1">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
