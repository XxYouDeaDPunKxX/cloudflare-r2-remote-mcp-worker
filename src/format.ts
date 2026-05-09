import { asR2McpError } from "./errors";

type ToolContent = {
  text: string;
  type: "text";
};

export type ToolResult = {
  content: [ToolContent];
  isError?: boolean;
};

export function jsonResult(payload: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function errorResult(error: unknown): ToolResult {
  const normalized = asR2McpError(error);

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: {
              code: normalized.code,
              details: normalized.details ?? null,
              message: normalized.message,
              status: normalized.status,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

