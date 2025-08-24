import { verifyToken, extractTokenFromHeader, checkRateLimit } from '../utils/auth.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Auth middleware to verify JWT token
export const requireAuth = async (c, next) => {
  try {
    const db = c.get('db');
    const authHeader = c.req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return c.json({ error: 'Authorization token required' }, 401);
    }
    
    // Verify token
    const decoded = verifyToken(token, c.env);
    
    // Get user from database
    const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    
    if (!user.length || !user[0].isActive) {
      return c.json({ error: 'Invalid token or user not found' }, 401);
    }
    
    // Add user to context
    c.set('user', user[0]);
    c.set('userId', user[0].id);
    
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ 
      error: error.message === 'Token expired' ? 'Token expired' : 'Invalid token' 
    }, 401);
  }
};

// Optional auth middleware (doesn't fail if no token)
export const optionalAuth = async (c, next) => {
  try {
    const db = c.get('db');
    const authHeader = c.req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (token) {
      try {
        const decoded = verifyToken(token, c.env);
        const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
        
        if (user.length && user[0].isActive) {
          c.set('user', user[0]);
          c.set('userId', user[0].id);
        }
      } catch (error) {
        // Silently ignore invalid tokens in optional auth
        console.warn('Optional auth token invalid:', error.message);
      }
    }
    
    await next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    await next(); // Continue without auth
  }
};

// Rate limiting middleware
export const rateLimitAuth = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  return async (c, next) => {
    // Get client IP (handle various proxy headers)
    const clientIP = c.req.header('CF-Connecting-IP') || 
                    c.req.header('X-Forwarded-For')?.split(',')[0] || 
                    c.req.header('X-Real-IP') || 
                    '127.0.0.1';
    
    const rateLimit = checkRateLimit(clientIP, maxAttempts, windowMs);
    
    if (!rateLimit.allowed) {
      const resetTimeISO = new Date(rateLimit.resetTime).toISOString();
      return c.json({ 
        error: 'Too many attempts',
        message: 'Rate limit exceeded. Please try again later.',
        resetTime: resetTimeISO
      }, 429);
    }
    
    // Add rate limit info to response headers
    c.res.headers.set('X-RateLimit-Remaining', rateLimit.remainingAttempts.toString());
    c.res.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());
    
    await next();
  };
};

// CORS middleware specifically for auth routes
export const authCors = async (c, next) => {
  // Set CORS headers for auth endpoints
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.res.headers.set('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }
  
  await next();
};

// Logging middleware for auth events
export const authLogger = async (c, next) => {
  const startTime = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const userAgent = c.req.header('User-Agent') || 'Unknown';
  const clientIP = c.req.header('CF-Connecting-IP') || 
                  c.req.header('X-Forwarded-For')?.split(',')[0] || 
                  c.req.header('X-Real-IP') || 
                  '127.0.0.1';
  
  await next();
  
  const duration = Date.now() - startTime;
  const status = c.res.status;
  
  // Log auth events
  console.log(`[AUTH] ${new Date().toISOString()} ${clientIP} ${method} ${path} ${status} ${duration}ms ${userAgent}`);
  
  // Log failed auth attempts
  if (status === 401 || status === 403) {
    console.warn(`[AUTH_FAIL] Failed authentication attempt from ${clientIP} to ${path}`);
  }
};