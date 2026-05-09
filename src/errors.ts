export class R2McpError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    options?: {
      details?: unknown;
      status?: number;
    },
  ) {
    super(message);
    this.name = "R2McpError";
    this.code = code;
    this.details = options?.details;
    this.status = options?.status ?? 400;
  }
}

export function asR2McpError(error: unknown): R2McpError {
  if (error instanceof R2McpError) {
    return error;
  }

  if (error instanceof Error) {
    return new R2McpError("internal_error", error.message, { status: 500 });
  }

  return new R2McpError("internal_error", "Unknown error", {
    details: error,
    status: 500,
  });
}

