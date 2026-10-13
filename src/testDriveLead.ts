import { AUTOELITE_API_BASE, DEFAULT_DEALER_ID } from './dealerPlatform';
import { Vehicle } from './types/inventory';
import { obtainTurnstileToken, resetTurnstileWidget, resolveTurnstileHost } from './turnstile';

/**
 * Public lead capture on the dealer platform.
 * POST /api/public/leads returns 400 until dealer_id, name, and either email or phone
 * are present, then 400 "Turnstile token required" / 403 "Bot verification failed".
 * The dealer-auth appointment route (/api/appointments, appointment_type test_drive)
 * answers 401 to this widget, so a test drive is stored as a public lead with type
 * test_drive. The on-site finance form is a separate credit application.
 */
export const PUBLIC_LEAD_URL = `${AUTOELITE_API_BASE}/api/public/leads`;

export interface TestDriveLeadDraft {
  dealerId: number;
  language: 'fr' | 'en';
  name: string;
  phone: string;
  email: string;
  preferredDate: string;
  preferredTime: string;
  vehicle: Vehicle;
}

export type TestDriveLeadFailure = 'verify' | 'rate' | 'network' | 'rejected';

export type TestDriveLeadResult =
  | { ok: true }
  | { ok: false; code: TestDriveLeadFailure };

export function testDriveVehicleSummary(vehicle: Vehicle): string {
  const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== '' && part !== 0)
    .join(' ');
  const details = [title];
  if (vehicle.stock_number) details.push(`stock ${vehicle.stock_number}`);
  if (vehicle.vin) details.push(`VIN ${vehicle.vin}`);
  if (vehicle.id) details.push(`id ${vehicle.id}`);
  return details.filter(Boolean).join(', ');
}

export function buildTestDriveLeadBody(draft: TestDriveLeadDraft, turnstileToken: string): Record<string, unknown> {
  const name = draft.name.trim();
  const phone = draft.phone.trim();
  const email = draft.email.trim();
  const preferredDate = draft.preferredDate.trim();
  const preferredTime = draft.preferredTime.trim();
  const when = [preferredDate, preferredTime].filter(Boolean).join(' ');
  const lines = [
    'Test drive request',
    `Vehicle: ${testDriveVehicleSummary(draft.vehicle)}`,
    `Language: ${draft.language}`,
  ];
  if (when) lines.push(`Preferred: ${when}`);

  const body: Record<string, unknown> = {
    dealer_id: draft.dealerId || DEFAULT_DEALER_ID,
    name,
    message: lines.join('\n'),
    source: 'lambert-chat',
    type: 'test_drive',
    language: draft.language,
    turnstileToken,
  };
  if (phone) body.phone = phone;
  if (email) body.email = email;
  if (draft.vehicle.id) body.vehicle_id = draft.vehicle.id;
  if (preferredDate) body.preferred_date = preferredDate;
  if (preferredTime) body.preferred_time = preferredTime;
  return body;
}

function leadHost(preferred: HTMLElement | null): HTMLElement | null {
  if (preferred && preferred.isConnected) return preferred;
  if (typeof document === 'undefined') return null;
  const onWidget = document.querySelector('#lambert-studio-chat > [data-turnstile-action="voice"]');
  if (onWidget instanceof HTMLElement) return onWidget;
  const any = document.querySelector('[data-turnstile-action="voice"]');
  if (any instanceof HTMLElement && any.isConnected) return any;
  const mount = document.createElement('div');
  mount.setAttribute('data-turnstile-action', 'voice');
  mount.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;left:0;bottom:0;';
  document.body.appendChild(mount);
  return mount;
}

function failureCode(status: number, errorText: string): TestDriveLeadFailure {
  if (status === 429 || /too many requests/i.test(errorText)) return 'rate';
  if (/turnstile|bot verification|security check/i.test(errorText) || status === 403) return 'verify';
  return 'rejected';
}

export async function submitTestDriveLead(
  draft: TestDriveLeadDraft,
  turnstileHost?: HTMLElement | null,
): Promise<TestDriveLeadResult> {
  const host = leadHost(turnstileHost ?? null);
  if (!host) return { ok: false, code: 'verify' };

  let turnstileToken = '';
  try {
    turnstileToken = await obtainTurnstileToken(host);
  } catch {
    resetTurnstileWidget();
    return { ok: false, code: 'verify' };
  }

  try {
    const response = await fetch(PUBLIC_LEAD_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildTestDriveLeadBody(draft, turnstileToken)),
    });
    let payload: { ok?: boolean; success?: boolean; error?: string; message?: string } | null = null;
    try {
      payload = (await response.json()) as { ok?: boolean; success?: boolean; error?: string; message?: string };
    } catch {
      payload = null;
    }
    const errorText = String(payload?.error || payload?.message || '');
    if (!response.ok || payload?.ok === false || payload?.success === false) {
      return { ok: false, code: failureCode(response.status, errorText) };
    }
    return { ok: true };
  } catch {
    return { ok: false, code: 'network' };
  } finally {
    resetTurnstileWidget();
  }
}

/** Light-DOM Turnstile mount used by the open chat, including the shadow-host slot. */
export function chatTurnstileHost(fallback: HTMLElement | null): HTMLElement | null {
  return leadHost(resolveTurnstileHost(fallback));
}
