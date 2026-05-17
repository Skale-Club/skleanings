/**
 * Maps admin-facing date format tokens (stored in companySettings.dateFormat)
 * to date-fns v3 format strings.
 */
export function toDateFnsFormat(adminFormat: string | null | undefined): string {
  switch (adminFormat) {
    case 'DD/MM/YYYY': return 'dd/MM/yyyy';
    case 'YYYY-MM-DD': return 'yyyy-MM-dd';
    case 'MM/DD/YYYY':
    default:           return 'MM/dd/yyyy';
  }
}
