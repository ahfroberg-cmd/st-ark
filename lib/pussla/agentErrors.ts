export function toAgentErrorMessage(error: unknown): string {
  const anyError = error as { message?: unknown };
  if (typeof anyError?.message === "string" && anyError.message.trim()) {
    return anyError.message;
  }
  return String(error);
}
