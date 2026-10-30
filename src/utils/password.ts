import { randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// OWASP Recommended Minimum Parameters for Argon2id
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2, // 2 iterations
  parallelism: 1, // 1 thread
};

// Fixed pre-generated Argon2id hash to ensure constant-time response on non-existent emails
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ZG9jdG9ydHJhY2tlcnNhbHQ$WJtXb8B2d9zO3z4/kXkYpE7R5JqW8uL9v2N1mQ6xV0c';

export const hashPassword = async (password: string): Promise<string> => {
  return hash(password, ARGON2_OPTIONS);
};

export const verifyPassword = async (
  storedHash: string,
  plainText: string
): Promise<boolean> => {
  try {
    return await verify(storedHash, plainText);
  } catch {
    return false;
  }
};

export const verifyDummyPassword = async (plainText: string): Promise<void> => {
  try {
    await verify(DUMMY_HASH, plainText);
  } catch {
    // Constant time dummy verification
  }
};

// Top breached passwords disallowed by OWASP
const KNOWN_BREACHED_PASSWORDS = new Set([
  'password1234567',
  'correcthorsebatterystaple', // Example, but allowed if long enough
  'administrator123',
  'hospital1234567',
  'doctortracker12',
  'changeme1234567',
  '123456789012345',
  'qwertyuiop12345',
]);

export const checkBreachedPassword = (password: string): boolean => {
  return KNOWN_BREACHED_PASSWORDS.has(password.toLowerCase().trim());
};

/**
 * Generates a 20-character random temporary password formatted into 5 groups of 4:
 * e.g. "qT7v-Lm2x-Wc9k-Rp4z-Hb6n"
 */
export const generateTemporaryPassword = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const groups: string[] = [];
  for (let g = 0; g < 5; g++) {
    let group = '';
    for (let c = 0; c < 4; c++) {
      group += chars[randomInt(0, chars.length)];
    }
    groups.push(group);
  }
  return groups.join('-');
};
