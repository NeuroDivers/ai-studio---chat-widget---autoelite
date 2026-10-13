import React, { useEffect, useState } from 'react';
import { Vehicle } from '../types/inventory';
import { useDealer } from '../dealerContext';
import { fetchVehiclePhotos, galleryPhotos, stockLabel } from '../dealerPlatform';
import { formatCadPrice, formatMileage } from './VehicleCard';
import { ArrowLeft, ChevronLeft, ChevronRight, Gauge, Tag, Zap, Cog, Fuel, Compass, Calendar, Phone, CheckCircle2 } from 'lucide-react';

type DetailLanguage = 'fr' | 'en';

interface VehicleDetailViewProps {
  vehicle: Vehicle;
  onBack: () => void;
  onRequestInfo?: (vehicle: Vehicle) => void;
  language?: DetailLanguage;
  /** overlay covers the docked chat. pane sits in the expanded split column. */
  layout?: 'overlay' | 'pane';
}

const COPY = {
  fr: {
    backMessages: 'Retour aux messages',
    backResults: 'Retour aux résultats',
    photoSoon: 'Photo à venir',
    previousPhoto: 'Photo précédente',
    nextPhoto: 'Photo suivante',
    photoLabel: (index: number, total: number) => `Photo ${index} sur ${total}`,
    available: 'Disponible',
    mileage: 'Kilométrage',
    drivetrain: 'Traction',
    transmission: 'Transmission',
    fuel: 'Carburant',
    exterior: 'Couleur extérieure',
    stock: 'Stock',
    stockLong: 'Numéro de stock',
    year: 'Année',
    make: 'Marque',
    model: 'Modèle',
    body: 'Carrosserie',
    vin: 'NIV',
    description: 'Description du véhicule',
    inspection: 'Inspection certifiée 150 points complétée',
    carfax: "Rapport d'historique CARFAX disponible sans frais",
    testDrive: 'Réserver un essai routier',
    taxes: 'CAD + taxes applicables',
    call: (phone: string) => `Appeler le concessionnaire : ${phone}`,
    fallback: (name: string) => `Véhicule disponible immédiatement chez ${name}.`,
  },
  en: {
    backMessages: 'Back to messages',
    backResults: 'Back to results',
    photoSoon: 'Photo coming soon',
    previousPhoto: 'Previous photo',
    nextPhoto: 'Next photo',
    photoLabel: (index: number, total: number) => `Photo ${index} of ${total}`,
    available: 'Available',
    mileage: 'Mileage',
    drivetrain: 'Drivetrain',
    transmission: 'Transmission',
    fuel: 'Fuel',
    exterior: 'Exterior color',
    stock: 'Stock',
    stockLong: 'Stock number',
    year: 'Year',
    make: 'Make',
    model: 'Model',
    body: 'Body style',
    vin: 'VIN',
    description: 'Vehicle description',
    inspection: '150-point certified inspection completed',
    carfax: 'CARFAX history report available at no charge',
    testDrive: 'Book a test drive',
    taxes: 'CAD plus applicable taxes',
    call: (phone: string) => `Call the dealer: ${phone}`,
    fallback: (name: string) => `Available now at ${name}.`,
  },
} as const;

function VehicleGallery({
  vehicle,
  alt,
  copy,
}: {
  vehicle: Vehicle;
  alt: string;
  copy: (typeof COPY)[DetailLanguage];
}) {
  const [photos, setPhotos] = useState<string[]>(() => galleryPhotos(vehicle));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const known = galleryPhotos(vehicle);
    setPhotos(known);
    setIndex(0);
    if (!vehicle.dealer_id) return;
    if (!(typeof vehicle.imageCount === 'number' && vehicle.imageCount > known.length)) return;
    let cancelled = false;
    fetchVehiclePhotos(vehicle.id, vehicle.dealer_id)
      .then((urls) => {
        if (cancelled || urls.length <= known.length) return;
        setPhotos(urls);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicle.id, vehicle.dealer_id, vehicle.imageCount, vehicle.photo, vehicle.photos]);

  const count = photos.length;
  const safeIndex = count === 0 ? 0 : ((index % count) + count) % count;
  const current = photos[safeIndex];
  const showStrip = count > 1;
  const go = (delta: number) => {
    if (count < 2) return;
    setIndex((prev) => (prev + delta + count) % count);
  };

  return (
    <div
      className="lambert-gallery"
      data-lambert-gallery=""
      tabIndex={showStrip ? 0 : undefined}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          go(1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          go(-1);
        }
      }}
    >
      <div className="lambert-gallery-frame" data-lambert-gallery-main="">
        {current ? (
          <img src={current} alt={showStrip ? `${alt} (${safeIndex + 1}/${count})` : alt} data-lambert-photo={safeIndex} />
        ) : (
          <div className="lambert-gallery-placeholder">{copy.photoSoon}</div>
        )}
        {showStrip ? (
          <>
            <button type="button" className="lambert-gallery-nav lambert-gallery-nav-prev" aria-label={copy.previousPhoto} onClick={() => go(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" className="lambert-gallery-nav lambert-gallery-nav-next" aria-label={copy.nextPhoto} onClick={() => go(1)}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>
      {showStrip ? (
        <div className="lambert-gallery-thumbs" data-lambert-thumbs="">
          {photos.map((src, photoIndex) => {
            const active = photoIndex === safeIndex;
            return (
              <button
                key={`${src}-${photoIndex}`}
                type="button"
                data-lambert-thumb={active ? 'active' : 'idle'}
                aria-label={copy.photoLabel(photoIndex + 1, count)}
                aria-current={active ? 'true' : undefined}
                onClick={() => setIndex(photoIndex)}
                className={active ? 'is-active' : undefined}
              >
                <img src={src} alt="" />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function vehicleTitle(vehicle: Vehicle): string {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== '' && part !== 0)
    .join(' ');
}

function liveSpecs(vehicle: Vehicle, copy: (typeof COPY)[DetailLanguage]): { label: string; value: string }[] {
  const specs: { label: string; value: string }[] = [];
  const add = (label: string, value: string | number | undefined | null) => {
    const text = value === undefined || value === null ? '' : String(value).trim();
    if (!text) return;
    specs.push({ label, value: text });
  };
  if (vehicle.year) add(copy.year, String(vehicle.year));
  add(copy.make, vehicle.make);
  add(copy.model, vehicle.model);
  add(copy.exterior, vehicle.exterior_color);
  if (Number.isFinite(vehicle.mileage)) add(copy.mileage, formatMileage(vehicle.mileage));
  add(copy.body, vehicle.body_label || vehicle.body_style);
  add(copy.drivetrain, vehicle.drivetrain);
  add(copy.transmission, vehicle.transmission);
  if (vehicle.vin) add(copy.vin, vehicle.vin);
  if (vehicle.stock_number) add(copy.stock, vehicle.stock_number);
  return specs;
}

export const VehicleDetailView: React.FC<VehicleDetailViewProps> = ({
  vehicle,
  onBack,
  onRequestInfo,
  language = 'fr',
  layout = 'overlay',
}) => {
  const dealer = useDealer();
  const copy = COPY[language];
  const title = vehicleTitle(vehicle);
  const photoAlt = title || 'Vehicle';

  if (layout === 'pane') {
    const specs = liveSpecs(vehicle, copy);
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col bg-white text-left" data-lambert-detail="pane">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 hover:text-[#991b1e]"
            aria-label={copy.backResults}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{copy.backResults}</span>
          </button>
          {(vehicle.stock_number || vehicle.vin) && (
            <span className="truncate text-xs font-medium text-gray-500">{stockLabel(vehicle)}</span>
          )}
        </div>

        <div className="lambert-detail-body min-h-0 flex-1" data-lambert-detail-body="">
          <div className="lambert-detail-columns" data-lambert-detail-columns="">
            <div className="lambert-detail-gallery" data-lambert-detail-gallery="">
              <VehicleGallery vehicle={vehicle} alt={photoAlt} copy={copy} />
            </div>

            <div className="lambert-detail-specs" data-lambert-detail-specs="">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-2xl font-bold leading-tight text-gray-900">{title}</h2>
                <div className="mt-1.5 text-2xl font-black text-[#991b1e]">{formatCadPrice(vehicle.price)}</div>
              </div>

              <div className="@container">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {specs.map((spec) => (
                    <div key={spec.label} className={`min-w-0 ${spec.label === copy.vin ? 'col-span-2' : ''}`}>
                      <dt className="text-[11px] font-medium text-gray-500">{spec.label}</dt>
                      <dd className={`mt-0.5 text-sm font-semibold break-words text-gray-900 ${spec.label === copy.vin ? 'font-mono text-[13px] break-all' : ''} ${spec.label === copy.exterior || spec.label === copy.transmission ? 'capitalize' : ''}`}>{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {vehicle.description ? (
                <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-3.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">{copy.description}</h4>
                  <p className="text-xs leading-relaxed text-gray-700">{vehicle.description}</p>
                </div>
              ) : null}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => onRequestInfo?.(vehicle)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#991b1e] px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#801618] active:bg-[#6b1214]"
                >
                  <Calendar className="h-4 w-4" />
                  <span>{copy.testDrive}</span>
                </button>
                {dealer.phone ? (
                  <a
                    href={dealer.phoneHref || undefined}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-200"
                  >
                    <Phone className="h-3.5 w-3.5 text-gray-600" />
                    <span>{copy.call(dealer.phone)}</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-white animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white p-3.5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 hover:text-[#991b1e]"
          aria-label={copy.backMessages}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{copy.backMessages}</span>
        </button>
        <span className="text-xs font-medium text-gray-500">{stockLabel(vehicle)}</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-left">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-200 shadow-inner">
          {vehicle.photo ? (
            <img src={vehicle.photo} alt={photoAlt} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-200 text-sm font-medium text-gray-500">
              {copy.photoSoon}
            </div>
          )}

          <div className="absolute top-3 left-3 rounded bg-[#991b1e] px-3 py-1 text-sm font-bold text-white shadow">
            {vehicle.year}
          </div>

          <div className="absolute top-3 right-3 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold tracking-wider text-white uppercase shadow">
            {copy.available}
          </div>
        </div>

        <div className="border-b border-gray-100 pb-3">
          <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            {vehicle.body_label || vehicle.body_style}
          </div>
          <h2 className="mt-0.5 text-xl font-bold leading-snug text-gray-900">
            {vehicle.make} {vehicle.model}{' '}
            <span className="text-lg font-medium text-gray-600">{vehicle.trim}</span>
          </h2>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#991b1e]">{formatCadPrice(vehicle.price)}</span>
            <span className="text-xs text-gray-500">{copy.taxes}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-gray-200/80 bg-gray-50 p-2.5">
            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <Gauge className="h-3.5 w-3.5 text-gray-400" />
              {copy.mileage}
            </div>
            <div className="mt-0.5 text-sm font-bold text-gray-900">{formatMileage(vehicle.mileage)}</div>
          </div>

          <div className="rounded-lg border border-gray-200/80 bg-gray-50 p-2.5">
            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <Compass className="h-3.5 w-3.5 text-gray-400" />
              {copy.drivetrain}
            </div>
            <div className="mt-0.5 text-sm font-bold text-gray-900 uppercase">{vehicle.drivetrain}</div>
          </div>

          <div className="rounded-lg border border-gray-200/80 bg-gray-50 p-2.5">
            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <Cog className="h-3.5 w-3.5 text-gray-400" />
              {copy.transmission}
            </div>
            <div className="mt-0.5 text-sm font-bold text-gray-900 capitalize">{vehicle.transmission}</div>
          </div>

          <div className="rounded-lg border border-gray-200/80 bg-gray-50 p-2.5">
            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <Fuel className="h-3.5 w-3.5 text-gray-400" />
              {copy.fuel}
            </div>
            <div className="mt-0.5 text-sm font-bold text-gray-900 capitalize">{vehicle.fuel_type}</div>
          </div>

          <div className="rounded-lg border border-gray-200/80 bg-gray-50 p-2.5">
            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <Zap className="h-3.5 w-3.5 text-gray-400" />
              {copy.exterior}
            </div>
            <div className="mt-0.5 text-sm font-bold text-gray-900 capitalize">{vehicle.exterior_color}</div>
          </div>

          <div className="rounded-lg border border-gray-200/80 bg-gray-50 p-2.5">
            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <Tag className="h-3.5 w-3.5 text-gray-400" />
              {copy.stockLong}
            </div>
            <div className="mt-0.5 text-sm font-bold text-gray-900">{stockLabel(vehicle)}</div>
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-3.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">{copy.description}</h4>
          <p className="text-xs leading-relaxed text-gray-700">
            {vehicle.description ||
              `${[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')}. ${copy.fallback(dealer.name)}`}
          </p>
        </div>

        <div className="space-y-1.5 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          <div className="flex items-center gap-2 font-medium text-gray-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {copy.inspection}
          </div>
          <div className="flex items-center gap-2 font-medium text-gray-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {copy.carfax}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => onRequestInfo?.(vehicle)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#991b1e] px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#801618] active:bg-[#6b1214]"
          >
            <Calendar className="h-4 w-4" />
            <span>{copy.testDrive}</span>
          </button>

          {dealer.phone ? (
            <a
              href={dealer.phoneHref || undefined}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-200"
            >
              <Phone className="h-3.5 w-3.5 text-gray-600" />
              <span>{copy.call(dealer.phone)}</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
};
