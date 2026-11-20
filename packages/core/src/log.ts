/**
 * Minimal JSON-lines logger (conventions/backend §6). The field list is deliberately closed:
 * message bodies, secrets, connection strings, raw error messages and IPs must never be logged.
 */
export interface LogFields {
  event: string;
  code?: string;
  durationMs?: number;
  analysisId?: string;
  caseId?: string;
}

export function logEvent(fields: LogFields): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...fields }));
}
