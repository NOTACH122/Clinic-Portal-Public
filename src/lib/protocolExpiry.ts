export const VALIDITY_OPTIONS = [
  { months: 6, labelKey: "sixMonths" },
  { months: 12, labelKey: "oneYear" },
  { months: 24, labelKey: "twoYears" },
  { months: 36, labelKey: "threeYears" },
] as const;

export function isProtocolExpired(
  protocolDate: string | null | undefined,
  validityMonths: number | null | undefined,
): boolean {
  if (!protocolDate || !validityMonths) return false;

  const expiry = new Date(protocolDate);
  expiry.setMonth(expiry.getMonth() + validityMonths);

  return new Date() >= expiry;
}

type ExpiryFields = {
  protocol_date?: string | null;
  validity_months?: number | null;
  expiry_acknowledged_at?: string | null;
};

export function isExpired(file: ExpiryFields): boolean {
  return isProtocolExpired(file.protocol_date, file.validity_months);
}

/** Expired and the clinic has not ticked it off yet - shown in red. */
export function isUnacknowledgedExpired(file: ExpiryFields): boolean {
  return isExpired(file) && !file.expiry_acknowledged_at;
}

export type FolderExpiryState = "none" | "acknowledged" | "expired";

/**
 * Worst expiry state among the given files, used to mark a folder: red if
 * anything inside is still unacknowledged, amber if everything expired in
 * there has been acknowledged.
 */
export function folderExpiryState(files: ExpiryFields[]): FolderExpiryState {
  let sawAcknowledged = false;

  for (const file of files) {
    if (!isExpired(file)) continue;
    if (!file.expiry_acknowledged_at) return "expired";
    sawAcknowledged = true;
  }

  return sawAcknowledged ? "acknowledged" : "none";
}
