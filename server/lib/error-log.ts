export interface ErrorEntry {
  timestamp: string; // ISO 8601
  message: string;
  stack?: string;
}

const MAX_ENTRIES = 50;
const errorLog: ErrorEntry[] = [];

export function appendError(entry: ErrorEntry): void {
  errorLog.push(entry);
  if (errorLog.length > MAX_ENTRIES) {
    errorLog.shift();
  }
}

export function getRecentErrors(): ErrorEntry[] {
  return [...errorLog].reverse(); // most recent first
}

let patched = false;
export function patchConsoleError(): void {
  if (patched) return;
  patched = true;
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalError(...args);
    const message = args.map(a => (a instanceof Error ? a.message : String(a))).join(" ");
    const stack = args.find(a => a instanceof Error) instanceof Error
      ? (args.find(a => a instanceof Error) as Error).stack
      : undefined;
    appendError({ timestamp: new Date().toISOString(), message, stack });
  };
}
