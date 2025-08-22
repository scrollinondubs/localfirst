import { scrypt } from '@noble/hashes/scrypt';
import { randomBytes } from '@noble/hashes/utils';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// JWT Secret - In production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'local-first-arizona-dev-secret-key';
const JWT_EXPIRES_IN = '24h';

// Scrypt parameters (equivalent security to bcrypt with 10 rounds)
const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost parameter (2^14)
  r: 8,     // Block size parameter  
  p: 1,     // Parallelization parameter
  dkLen: 64 // Derived key length (bytes)
};
const SALT_LENGTH = 32; // Salt length in bytes

// Validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email format')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

// Helper functions for encoding/decoding
const bytesToHex = (bytes) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const hexToBytes = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
const textToBytes = (text) => new TextEncoder().encode(text);

// Password utilities using Scrypt
export const hashPassword = async (password) => {
  try {
    // Generate a random salt
    const salt = randomBytes(SALT_LENGTH);
    
    // Hash password with scrypt
    const hashedBytes = scrypt(textToBytes(password), salt, SCRYPT_PARAMS);
    
    // Combine salt and hash for storage (salt:hash format)
    const saltHex = bytesToHex(salt);
    const hashHex = bytesToHex(hashedBytes);
    
    return `${saltHex}:${hashHex}`;
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};

export const verifyPassword = async (password, storedHash) => {
  try {
    // Parse stored hash to extract salt and hash
    const [saltHex, hashHex] = storedHash.split(':');
    if (!saltHex || !hashHex) {
      throw new Error('Invalid hash format');
    }
    
    const salt = hexToBytes(saltHex);
    const expectedHash = hexToBytes(hashHex);
    
    // Hash the provided password with the same salt
    const providedHashBytes = scrypt(textToBytes(password), salt, SCRYPT_PARAMS);
    
    // Constant-time comparison to prevent timing attacks
    if (providedHashBytes.length !== expectedHash.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < providedHashBytes.length; i++) {
      result |= providedHashBytes[i] ^ expectedHash[i];
    }
    
    return result === 0;
  } catch (error) {
    throw new Error('Password verification failed');
  }
};

// JWT utilities
export const generateToken = (payload) => {
  try {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return token;
  } catch (error) {
    throw new Error('Token generation failed');
  }
};

export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
};

// Generate reset token (UUID-like string)
export const generateResetToken = () => {
  return crypto.randomUUID();
};

// Check if reset token is expired (valid for 1 hour)
export const isResetTokenExpired = (expiryTimestamp) => {
  return new Date() > new Date(expiryTimestamp);
};

// Create reset token expiry timestamp (1 hour from now)
export const createResetTokenExpiry = () => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 1);
  return expiry.toISOString();
};

// Extract token from Authorization header
export const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

// Validate email format more strictly
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Check password strength
export const checkPasswordStrength = (password) => {
  const checks = {
    minLength: password.length >= 6,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password),
  };
  
  const strength = Object.values(checks).filter(Boolean).length;
  
  return {
    isValid: checks.minLength,
    strength: strength >= 2 ? 'strong' : strength >= 1 ? 'medium' : 'weak',
    checks
  };
};

// Rate limiting helper (simple in-memory store for development)
const rateLimitStore = new Map();

export const checkRateLimit = (ip, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Get or create attempts array for this IP
  let attempts = rateLimitStore.get(ip) || [];
  
  // Remove old attempts outside the window
  attempts = attempts.filter(timestamp => timestamp > windowStart);
  
  // Check if over limit
  if (attempts.length >= maxAttempts) {
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime: Math.min(...attempts) + windowMs
    };
  }
  
  // Add current attempt
  attempts.push(now);
  rateLimitStore.set(ip, attempts);
  
  return {
    allowed: true,
    remainingAttempts: maxAttempts - attempts.length,
    resetTime: now + windowMs
  };
};