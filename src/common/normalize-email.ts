import { Transform } from 'class-transformer';

/** Emails are stored and compared trimmed and lower-cased ("A@x.dz" and "a@x.dz" are one account). */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const NormalizeEmail = () =>
  Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value));
