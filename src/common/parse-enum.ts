import { BadRequestException } from '@nestjs/common';

/** Validates an optional query-string value against an enum; empty means "no filter". */
export function parseOptionalEnum<T extends Record<string, string>>(
  enumObj: T,
  value: string | undefined,
  name: string,
): T[keyof T] | undefined {
  if (value === undefined || value === '') return undefined;
  if (!Object.values(enumObj).includes(value)) {
    throw new BadRequestException(`Invalid ${name}. Allowed: ${Object.values(enumObj).join(', ')}`);
  }
  return value as T[keyof T];
}
