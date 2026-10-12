import React, { useState } from 'react';
import { Vehicle } from '../types/inventory';
import { useDealer } from '../dealerContext';
import { VehicleCard } from './VehicleCard';
import {
  Car,
  Search,
  ShieldCheck,
  Award,
  Phone,
  Clock,
  MapPin,
  Sparkles,
  SlidersHorizontal,
  BadgePercent,
  Check,
} from 'lucide-react';

interface DealerInventoryPageProps {
  vehicles: Vehicle[];
  inventorySource?: 'loading' | 'autoelite' | 'prototype';
  onSelectVehicle: (vehicle: Vehicle) => void;
  onOpenAssistantForSearch?: (term: string) => void;
}

export const DealerInventoryPage: React.FC<DealerInventoryPageProps> = ({
  vehicles,
  inventorySource = 'loading',
  onSelectVehicle,
}) => {
  const dealer = useDealer();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const highestPrice = vehicles.reduce((max, vehicle) => Math.max(max, vehicle.price), 20000);
  const sliderMax = Math.ceil(highestPrice / 1000) * 1000;
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const budget = maxPrice ?? sliderMax;

  // Filter available inventory for the main page
  const filteredVehicles = vehicles.filter((v) => {
    if (v.status !== 'available') return false;
    if (v.price > budget) return false;

    if (activeCategory === 'vus' && v.body_style.toLowerCase() !== 'vus') return false;
    if (activeCategory === 'berline' && v.body_style.toLowerCase() !== 'berline') return false;
    if (activeCategory === 'camion' && v.body_style.toLowerCase() !== 'camion') return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.trim.toLowerCase().includes(q) ||
        v.body_style.toLowerCase().includes(q) ||
        (v.body_label || '').toLowerCase().includes(q) ||
        v.exterior_color.toLowerCase().includes(q) ||
        v.drivetrain.toLowerCase().includes(q) ||
        v.year.toString().includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 flex flex-col font-sans">
      {/* Top Banner / Dealership Information */}
      <div className="bg-[#1f2937] text-gray-300 text-xs py-2 px-4 border-b border-gray-700">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#991b1e]" />
              {dealer.addressLine}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#991b1e]" />
              Aujourd'hui : {dealer.hoursToday}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={dealer.phoneHref}
              className="flex items-center gap-1.5 font-bold text-white hover:text-[#991b1e] transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-[#991b1e]" />
              {dealer.phone}
            </a>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">FR / EN</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#991b1e] flex items-center justify-center text-white shadow-md">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight block leading-none">
                {dealer.name}
              </span>
              <span className="text-[11px] font-semibold text-gray-500 tracking-wider uppercase">
                Concessionnaire Certifié • Véhicules d'occasion
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-700">
            <a href="#inventory" className="text-[#991b1e] hover:text-[#801618] transition-colors">
              Inventaire disponible
            </a>
            <a href="#financing" className="hover:text-[#991b1e] transition-colors">
              Financement 100%
            </a>
            <a href="#guarantee" className="hover:text-[#991b1e] transition-colors">
              Garantie & Certification
            </a>
            <a href="#contact" className="hover:text-[#991b1e] transition-colors">
              À propos & Contact
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white py-12 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#991b1e_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl text-left space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#991b1e]/30 border border-[#991b1e] text-red-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-red-300" />
              Inventaire inspecté et certifié disponible immédiatement
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Trouvez votre prochain véhicule avec notre{' '}
              <span className="text-red-400">assistant vocal direct</span>.
            </h1>
            <p className="text-gray-300 text-base max-w-xl">
              Tous nos véhicules sont rigoureusement inspectés en 150 points avec historique CARFAX vérifié. Utilisez notre clavardage interactif ou le bouton vocal pour rechercher votre modèle idéal.
            </p>
          </div>

          {/* Quick Value Props */}
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 text-left">
              <ShieldCheck className="w-6 h-6 text-red-400 mb-1" />
              <div className="font-bold text-sm">Garantie certifiée</div>
              <div className="text-xs text-gray-300">Inspection 150 points</div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 text-left">
              <BadgePercent className="w-6 h-6 text-red-400 mb-1" />
              <div className="font-bold text-sm">Financement facile</div>
              <div className="text-xs text-gray-300">1ère, 2e et 3e chance</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Inventory Section */}
      <main id="inventory" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        {/* Filter Controls Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs text-left space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par marque, modèle, carrosserie ou couleur (ex: Honda, VUS, AWD)..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#991b1e]/30 focus:border-[#991b1e]"
              />
            </div>

            {/* Price slider */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Budget max :
              </span>
              <input
                type="range"
                min="5000"
                max={sliderMax}
                step={sliderMax > 50000 ? 5000 : 1000}
                value={budget}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-32 accent-[#991b1e] cursor-pointer"
              />
              <span className="text-xs font-black text-[#991b1e] min-w-[70px]">
                {budget.toLocaleString('fr-CA')} $ CAD
              </span>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-[#991b1e] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous les véhicules ({vehicles.filter((v) => v.status === 'available').length})
            </button>
            <button
              onClick={() => setActiveCategory('vus')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeCategory === 'vus'
                  ? 'bg-[#991b1e] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              VUS & Crossovers (SUV)
            </button>
            <button
              onClick={() => setActiveCategory('berline')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeCategory === 'berline'
                  ? 'bg-[#991b1e] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Berlines (Sedan)
            </button>
            <button
              onClick={() => setActiveCategory('camion')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeCategory === 'camion'
                  ? 'bg-[#991b1e] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Camions & Camionnettes (Truck)
            </button>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between px-1">
          <div className="text-left">
            <h2 className="text-xl font-bold text-gray-900">
              Véhicules en inventaire
            </h2>
            <p className="text-xs text-gray-500">
              {filteredVehicles.length} véhicule(s) disponible(s) prêt(s) pour livraison
            </p>
          </div>
        </div>

        {/* Inventory Cards Grid */}
        {filteredVehicles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onSelect={(v) => onSelectVehicle(v)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-100 text-[#991b1e] flex items-center justify-center mx-auto">
              <Car className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              Aucun véhicule trouvé
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Aucun véhicule disponible ne correspond à ces critères. Utilisez notre assistant de clavardage en bas à droite pour explorer d'autres options.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setActiveCategory('all');
                setMaxPrice(null);
              }}
              className="text-xs font-bold text-[#991b1e] hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {/* Dealership Trust & Value Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-left space-y-2">
            <Award className="w-7 h-7 text-[#991b1e]" />
            <h3 className="font-bold text-base text-gray-900">Certification Lambert</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Chaque véhicule usagé subit un examen mécanique et esthétique rigoureux de 150 points avant d'être mis en vente.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 text-left space-y-2">
            <BadgePercent className="w-7 h-7 text-[#991b1e]" />
            <h3 className="font-bold text-base text-gray-900">Taux de financement avantageux</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Partenariats avec toutes les grandes institutions financières du Québec pour vous obtenir le meilleur taux possible.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 text-left space-y-2">
            <ShieldCheck className="w-7 h-7 text-[#991b1e]" />
            <h3 className="font-bold text-base text-gray-900">Garantie de satisfaction</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Privilège d'échange de 7 jours ou 500 km sur tous nos véhicules d'occasion certifiés. Achetez l'esprit tranquille.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer id="contact" className="bg-white border-t border-gray-200 mt-12 py-8 px-4 sm:px-6 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <div className="font-bold text-gray-900 text-sm">{dealer.name}</div>
            <div>{dealer.addressLine} • Téléphone : {dealer.phone}</div>
          </div>
          <div className="flex items-center gap-4 text-gray-600">
            <span>© {new Date().getFullYear()} {dealer.name}. Tous droits réservés.</span>
            <span>•</span>
            <span>
              {inventorySource === 'autoelite'
                ? 'Inventaire en direct'
                : inventorySource === 'prototype'
                  ? 'Inventaire de démonstration'
                  : 'Chargement de l’inventaire'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <Check className="w-3.5 h-3.5" /> Clavardage & Voix Live activés
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
