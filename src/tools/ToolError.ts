export type ToolErrorCode =
  | 'MISSING_CREDENTIAL' // retryable: false
  | 'AUTH_ERROR' // retryable: false
  | 'TENANT_SCOPE_VIOLATION' // retryable: false
  | 'INVALID_INPUT' // retryable: false
  | 'TOOL_NOT_FOUND' // retryable: false
  | 'RATE_LIMIT' // retryable: true
  | 'DOWNSTREAM_UNAVAILABLE' // retryable: true
  | 'DOWNSTREAM_ERROR'; // retryable: false

const RETRYABLE: Record<ToolErrorCode, boolean> = {
  MISSING_CREDENTIAL: false,
  AUTH_ERROR: false,
  TENANT_SCOPE_VIOLATION: false,
  INVALID_INPUT: false,
  TOOL_NOT_FOUND: false,
  RATE_LIMIT: true,
  DOWNSTREAM_UNAVAILABLE: true,
  DOWNSTREAM_ERROR: false,
};

export interface ToolErrorDetail {
  code: ToolErrorCode;
  message: string;
  retryable: boolean;
}

export interface ToolOutput {
  success: boolean;
  data: Record<string, unknown> | null;
  errors: ToolErrorDetail[];
}

export class ToolExecutionError extends Error {
  readonly code: ToolErrorCode;
  readonly retryable: boolean;

  constructor(code: ToolErrorCode, message: string) {
    super(message);
    this.name = 'ToolExecutionError';
    this.code = code;
    this.retryable = RETRYABLE[code];
  }
}

export function wrapToolError(err: unknown): ToolErrorDetail {
  if (err instanceof ToolExecutionError) {
    return { code: err.code, message: err.message, retryable: err.retryable };
  }
  const msg = err instanceof Error ? err.message : String(err);
  // Network / timeout patterns → retryable
  const retryable = /timeout|ECONNREFUSED|ENOTFOUND|503|429/i.test(msg);
  return {
    code: retryable ? 'DOWNSTREAM_UNAVAILABLE' : 'DOWNSTREAM_ERROR',
    message: msg,
    retryable,
  };
}
