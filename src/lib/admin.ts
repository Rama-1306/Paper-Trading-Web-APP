export function getConfiguredAdminEmail(): string | null {
  const raw = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function isAdminEmail(email?: string | null): boolean {
  const adminEmail = getConfiguredAdminEmail();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}
