import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Loader2, CheckCircle2, X } from 'lucide-react';
import { Vehicle } from '../types/inventory';
import { TestDriveLeadDraft, TestDriveLeadResult, testDriveVehicleSummary } from '../testDriveLead';

type FormLanguage = 'fr' | 'en';

const COPY = {
  fr: {
    title: 'Réserver un essai routier',
    name: 'Nom',
    phone: 'Téléphone',
    email: 'Courriel',
    contactHint: 'Un téléphone ou un courriel suffit.',
    day: 'Jour souhaité (optionnel)',
    time: 'Heure souhaitée (optionnel)',
    submit: 'Envoyer la demande',
    sending: 'Envoi…',
    cancel: 'Annuler',
    close: 'Fermer',
    nameRequired: 'Entrez votre nom.',
    contactRequired: 'Entrez un téléphone ou un courriel.',
    emailInvalid: 'Entrez un courriel valide.',
    phoneInvalid: 'Entrez un numéro de téléphone valide.',
    success: 'Votre demande d’essai routier est envoyée. Un conseiller d’Automobile Lambert vous contactera.',
    errorGeneric: 'La demande n’a pas pu être envoyée. Réessayez.',
    errorVerify: 'La vérification de sécurité a échoué. Réessayez.',
    errorRate: 'Trop de demandes pour le moment. Réessayez plus tard.',
    errorNetwork: 'Connexion impossible. Réessayez.',
  },
  en: {
    title: 'Book a test drive',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    contactHint: 'A phone number or email is enough.',
    day: 'Preferred day (optional)',
    time: 'Preferred time (optional)',
    submit: 'Send request',
    sending: 'Sending…',
    cancel: 'Cancel',
    close: 'Close',
    nameRequired: 'Enter your name.',
    contactRequired: 'Enter a phone number or email.',
    emailInvalid: 'Enter a valid email.',
    phoneInvalid: 'Enter a valid phone number.',
    success: 'Your test drive request was sent. An advisor at Automobile Lambert will contact you.',
    errorGeneric: 'The request could not be sent. Please try again.',
    errorVerify: 'The security check failed. Please try again.',
    errorRate: 'Too many requests right now. Please try again later.',
    errorNetwork: 'Could not connect. Please try again.',
  },
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function failureCopy(language: FormLanguage, result: Extract<TestDriveLeadResult, { ok: false }>): string {
  const copy = COPY[language];
  if (result.code === 'verify') return copy.errorVerify;
  if (result.code === 'rate') return copy.errorRate;
  if (result.code === 'network') return copy.errorNetwork;
  return copy.errorGeneric;
}

interface TestDriveFormProps {
  vehicle: Vehicle;
  language: FormLanguage;
  dealerId: number;
  onCancel: () => void;
  onSubmit: (draft: TestDriveLeadDraft) => Promise<TestDriveLeadResult>;
}

export const TestDriveForm: React.FC<TestDriveFormProps> = ({
  vehicle,
  language,
  dealerId,
  onCancel,
  onSubmit,
}) => {
  const copy = COPY[language];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    nameRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!fieldError && !submitError) return;
    errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [fieldError, submitError]);

  const inputClass =
    'box-border block w-full min-w-0 max-w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#991b1e] focus:outline-none focus:ring-2 focus:ring-[#991b1e]/30';

  const closeButton = (
    <button
      type="button"
      onClick={onCancel}
      disabled={submitting}
      aria-label={copy.close}
      data-lambert-test-drive-close=""
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 hover:text-[#991b1e] disabled:opacity-70"
    >
      <X className="h-4 w-4" />
    </button>
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || done) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const digits = phoneDigits(trimmedPhone);
    const emailOk = EMAIL_PATTERN.test(trimmedEmail);
    const phoneOk = digits.length >= 7;

    if (!trimmedName) {
      setFieldError(copy.nameRequired);
      setSubmitError('');
      return;
    }
    if (!trimmedPhone && !trimmedEmail) {
      setFieldError(copy.contactRequired);
      setSubmitError('');
      return;
    }
    if (trimmedEmail && !emailOk && !phoneOk) {
      setFieldError(copy.emailInvalid);
      setSubmitError('');
      return;
    }
    if (trimmedPhone && !phoneOk && !emailOk) {
      setFieldError(copy.phoneInvalid);
      setSubmitError('');
      return;
    }

    setFieldError('');
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await onSubmit({
        dealerId,
        language,
        name: trimmedName,
        phone: phoneOk ? trimmedPhone : '',
        email: emailOk ? trimmedEmail : '',
        preferredDate,
        preferredTime,
        vehicle,
      });
      if (result.ok) {
        setDone(true);
        return;
      }
      setSubmitError(failureCopy(language, result));
    } catch {
      setSubmitError(copy.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-w-0 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3" data-lambert-test-drive-form="success" role="status">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{copy.success}</span>
          </div>
          {closeButton}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-2" data-lambert-test-drive-form="open" noValidate>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id="lambert-test-drive-title" className="text-sm font-bold leading-tight text-gray-900">{copy.title}</h3>
          <p className="truncate text-xs leading-snug text-gray-600">{testDriveVehicleSummary(vehicle)}</p>
        </div>
        {closeButton}
      </div>
      <label className="block min-w-0 space-y-0.5">
        <span className="text-[11px] font-medium text-gray-500">{copy.name}</span>
        <input
          ref={nameRef}
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
          aria-invalid={fieldError === copy.nameRequired || undefined}
          required
        />
      </label>
      <div className="lambert-test-drive-pair">
        <label className="block min-w-0 space-y-0.5">
          <span className="text-[11px] font-medium text-gray-500">{copy.phone}</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block min-w-0 space-y-0.5">
          <span className="text-[11px] font-medium text-gray-500">{copy.email}</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <p className="text-[11px] leading-snug text-gray-500">{copy.contactHint}</p>
      <div className="lambert-test-drive-pair">
        <label className="block min-w-0 space-y-0.5">
          <span className="text-[11px] font-medium text-gray-500">{copy.day}</span>
          <input
            name="preferredDate"
            type="date"
            value={preferredDate}
            onChange={(event) => setPreferredDate(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block min-w-0 space-y-0.5">
          <span className="text-[11px] font-medium text-gray-500">{copy.time}</span>
          <input
            name="preferredTime"
            type="time"
            value={preferredTime}
            onChange={(event) => setPreferredTime(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      {fieldError ? (
        <p ref={errorRef} className="text-xs font-medium text-[#991b1e]" role="alert" data-lambert-test-drive-error="validation">
          {fieldError}
        </p>
      ) : null}
      {submitError ? (
        <p ref={errorRef} className="text-xs font-medium text-[#991b1e]" role="alert" data-lambert-test-drive-error="submit">
          {submitError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        data-lambert-test-drive-submit=""
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#991b1e] px-4 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#801618] active:bg-[#6b1214] disabled:opacity-70"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
        <span>{submitting ? copy.sending : copy.submit}</span>
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="flex w-full items-center justify-center rounded-xl bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-200 disabled:opacity-70"
      >
        {copy.cancel}
      </button>
    </form>
  );
};
