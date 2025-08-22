import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// JWT Secret - In production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'local-first-arizona-dev-secret-key';
const JWT_EXPIRES_IN = '24h';
const SALT_ROUNDS = 10;

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

// Password utilities
export const hashPassword = async (password) => {
  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};

export const verifyPassword = async (password, hashedPassword) => {
  try {
    const isValid = await bcrypt.compare(password, hashedPassword);
    return isValid;
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