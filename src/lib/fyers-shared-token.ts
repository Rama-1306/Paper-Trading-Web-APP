let sharedFyersToken: string | null = null;

export function setSharedFyersToken(token: string | null | undefined) {
  const normalized = token?.trim();
  sharedFyersToken = normalized && normalized.length > 0 ? normalized : null;
}

export function getSharedFyersToken(): string | null {
  return sharedFyersToken;
}
