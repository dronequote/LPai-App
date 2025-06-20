// src/utils/security/tokenGenerator.ts
import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token
 * @param length - Length of the token (default 32 bytes = 64 hex chars)
 * @returns A secure random token as a hex string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure token with expiry
 * @param expiryHours - Hours until token expires (default 24)
 * @returns Object with token and expiry date
 */
export function generateTokenWithExpiry(expiryHours: number = 24) {
  const token = generateSecureToken();
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + expiryHours);
  
  return {
    token,
    expiry
  };
}