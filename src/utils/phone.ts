import { AppError } from './errors.js';

/**
 * Normalizes phone numbers to standard E.164 format (+8801712345678).
 * Accepts:
 * - Local Bangladesh formats (e.g. "01712345678", "017-1234-5678", "017 1234 5678")
 * - International BD formats (e.g. "+8801712345678", "8801712345678")
 * - Standard international E.164 formats (e.g. "+14155552671")
 */
export function formatE164Phone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new AppError('Phone number is required', 400, 'VALIDATION_ERROR', [
      { path: 'phone', message: 'Phone number is required' },
    ]);
  }

  const cleaned = phone.replace(/[\s\-_()]/g, '');

  // 1. Local BD mobile format: 013-019 followed by 8 digits (11 digits total)
  if (/^01[3-9]\d{8}$/.test(cleaned)) {
    return `+88${cleaned}`;
  }

  // 2. BD format starting with 8801 (13 digits total)
  if (/^8801[3-9]\d{8}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // 3. BD format starting with +8801 (14 digits total with +)
  if (/^\+8801[3-9]\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  // 4. Standard international E.164 (+ followed by 8 to 15 digits)
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return cleaned;
  }

  // 5. International number without '+' prefix (8 to 15 digits)
  if (/^[1-9]\d{7,14}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  throw new AppError(
    'Invalid phone number format. Provide a valid local (01...) or E.164 (+880...) phone number.',
    400,
    'VALIDATION_ERROR',
    [{ path: 'phone', message: 'Enter a valid phone number (e.g. +8801712345678 or 01712345678)' }]
  );
}

