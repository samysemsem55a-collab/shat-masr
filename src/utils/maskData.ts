/**
 * Data Masking Utilities (Global Security & Privacy Rule)
 * Masks sensitive fields (Email, Phone, Wallet ID, Transaction ID/Ref)
 * so only the last 3 characters are visible preceded by ****.
 */

export function maskSensitiveValue(value?: string | null): string {
  if (!value) return '****';
  const trimmed = String(value).trim();
  if (!trimmed) return '****';
  if (trimmed.length <= 3) return `****${trimmed}`;
  return `****${trimmed.slice(-3)}`;
}

export function maskEmail(email?: string | null): string {
  if (!email) return '****';
  const trimmed = String(email).trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) return maskSensitiveValue(trimmed);
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const tail = trimmed.slice(-3);
  if (domain.length >= 3) {
    return `****${local.slice(-1)}@${domain.slice(0, 1)}***${tail}`;
  }
  return `****${tail}`;
}

export function maskPhone(phone?: string | null): string {
  return maskSensitiveValue(phone);
}

export function maskTransactionId(txId?: string | null): string {
  return maskSensitiveValue(txId);
}
