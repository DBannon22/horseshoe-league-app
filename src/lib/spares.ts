import type { Spare } from './types';

const PHONE = /((?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\s*$/;

/**
 * Turns a pasted list into spares, one per line, e.g. "Pat Smith 519.555.0100".
 * The phone number is taken from the end of the line; a line with no number
 * becomes a spare with a blank phone.
 */
export function parseSpares(text: string): Omit<Spare, 'id'>[] {
  const out: Omit<Spare, 'id'>[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(PHONE);
    const phone = m ? m[1].trim() : '';
    const name = (m ? line.slice(0, m.index) : line)
      .replace(/[\s,;:|–—-]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name) out.push({ name, phone });
  }
  return out;
}

/** 519-555-0100 for a 10-digit number; otherwise as typed. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : phone;
}

/** Link that starts a call on a phone. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function newSpareId(): string {
  return Math.random().toString(36).slice(2, 10);
}
