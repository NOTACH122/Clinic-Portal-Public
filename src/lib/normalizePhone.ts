// Strips everything but digits so "+995 555 12-34-56" and "995555123456"
// are treated as the same value for storage and lookup.
export function normalizePhone(input: string): string {
  return input.replace(/[^0-9]/g, "");
}
