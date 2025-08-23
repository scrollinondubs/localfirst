import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  registerSchema,
  loginSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
  hashPassword,
  verifyPassword,
  generateToken,
  generateResetToken,
  createResetTokenExpiry,
  isResetTokenExpired
} from '../utils/auth.js';
import { rateLimitAuth, authLogger, requireAuth } from '../middleware/auth.js';

const auth = new Hono();

// Apply middleware to all auth routes
auth.use('*', authLogger);
auth.use('/login', rateLimitAuth(5, 15 * 60 * 1000)); // 5 attempts per 15 minutes
// Temporarily disable rate limiting for register during development
// auth.use('/register', rateLimitAuth(3, 60 * 60 * 1000)); // 3 attempts per hour
auth.use('/reset-password-request', rateLimitAuth(3, 60 * 60 * 1000)); // 3 attempts per hour

// User Registration
auth.post('/register', async (c) => {
  try {
    const db = c.get('db');
    const body = await c.req.json();
    
    // Validate input
    const validatedData = registerSchema.parse(body);
    const { email, password, name } = validatedData;
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    
    if (existingUser.length > 0) {
      return c.json({ error: 'User with this email already exists' }, 400);
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const userId = uuidv4();
    const now = new Date().toISOString();
    
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
      isActive: true
    };
    
    await db.insert(users).values(newUser);
    
    // Generate JWT token
    const token = generateToken({ userId, email: email.toLowerCase() });
    
    // Return user data (without password hash)
    const userResponse = {
      id: userId,
      email: email.toLowerCase(),
      name: name || null,
      createdAt: now
    };
    
    return c.json({
      success: true,
      message: 'User registered successfully',
      user: userResponse,
      token
    }, 201);
    
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ZodError') {
      return c.json({
        error: 'Validation failed',
        details: error.errors.map(err => ({ field: err.path[0], message: err.message }))
      }, 400);
    }
    
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// User Login
auth.post('/login', async (c) => {
  try {
    const db = c.get('db');
    const body = await c.req.json();
    
    // Validate input
    const validatedData = loginSchema.parse(body);
    const { email, password } = validatedData;
    
    // Find user by email
    const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    
    if (!user.length || !user[0].isActive) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, user[0].passwordHash);
    
    if (!isPasswordValid) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }
    
    // Update last login
    const now = new Date().toISOString();
    await db.update(users)
      .set({ lastLogin: now, updatedAt: now })
      .where(eq(users.id, user[0].id));
    
    // Generate JWT token
    const token = generateToken({ userId: user[0].id, email: user[0].email });
    
    // Return user data (without password hash)
    const userResponse = {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
      createdAt: user[0].createdAt,
      lastLogin: now
    };
    
    return c.json({
      success: true,
      message: 'Login successful',
      user: userResponse,
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.name === 'ZodError') {
      return c.json({
        error: 'Validation failed',
        details: error.errors.map(err => ({ field: err.path[0], message: err.message }))
      }, 400);
    }
    
    return c.json({ error: 'Login failed' }, 500);
  }
});

// Verify Token
auth.get('/verify', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    
    // Return user data (without password hash)
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };
    
    return c.json({
      success: true,
      user: userResponse
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    return c.json({ error: 'Token verification failed' }, 500);
  }
});

// Get User Profile
auth.get('/profile', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    
    // Return detailed user profile
    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      isActive: user.isActive
    };
    
    return c.json({
      success: true,
      profile: userProfile
    });
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

// Request Password Reset
auth.post('/reset-password-request', async (c) => {
  try {
    const db = c.get('db');
    const body = await c.req.json();
    
    // Validate input
    const validatedData = resetPasswordRequestSchema.parse(body);
    const { email } = validatedData;
    
    // Find user by email
    const user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    
    // Always return success to prevent email enumeration
    // But only actually send reset email if user exists
    if (user.length > 0 && user[0].isActive) {
      // Generate reset token
      const resetToken = generateResetToken();
      const resetTokenExpiry = createResetTokenExpiry();
      
      // Update user with reset token
      await db.update(users)
        .set({ 
          resetToken,
          resetTokenExpiry,
          updatedAt: new Date().toISOString()
        })
        .where(eq(users.id, user[0].id));
      
      // In a real app, you would send an email here
      // For development, we'll log the reset token
      console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
      
      // In development, return the token directly
      // In production, remove this and send via email
      if (process.env.NODE_ENV !== 'production') {
        return c.json({
          success: true,
          message: 'Reset token generated',
          resetToken: resetToken // Only for development!
        });
      }
    }
    
    return c.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });
    
  } catch (error) {
    console.error('Password reset request error:', error);
    
    if (error.name === 'ZodError') {
      return c.json({
        error: 'Validation failed',
        details: error.errors.map(err => ({ field: err.path[0], message: err.message }))
      }, 400);
    }
    
    return c.json({ error: 'Password reset request failed' }, 500);
  }
});

// Reset Password
auth.post('/reset-password', async (c) => {
  try {
    const db = c.get('db');
    const body = await c.req.json();
    
    // Validate input
    const validatedData = resetPasswordSchema.parse(body);
    const { token, password } = validatedData;
    
    // Find user by reset token
    const user = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
    
    if (!user.length || !user[0].isActive) {
      return c.json({ error: 'Invalid or expired reset token' }, 400);
    }
    
    // Check if token is expired
    if (!user[0].resetTokenExpiry || isResetTokenExpired(user[0].resetTokenExpiry)) {
      return c.json({ error: 'Reset token has expired' }, 400);
    }
    
    // Hash new password
    const passwordHash = await hashPassword(password);
    
    // Update user password and clear reset token
    const now = new Date().toISOString();
    await db.update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: now
      })
      .where(eq(users.id, user[0].id));
    
    return c.json({
      success: true,
      message: 'Password reset successfully'
    });
    
  } catch (error) {
    console.error('Password reset error:', error);
    
    if (error.name === 'ZodError') {
      return c.json({
        error: 'Validation failed',
        details: error.errors.map(err => ({ field: err.path[0], message: err.message }))
      }, 400);
    }
    
    return c.json({ error: 'Password reset failed' }, 500);
  }
});

// Update Profile (authenticated)
auth.put('/profile', requireAuth, async (c) => {
  try {
    const db = c.get('db');
    const userId = c.get('userId');
    const body = await c.req.json();
    
    // Only allow updating name for now
    const { name } = body;
    
    if (name !== undefined) {
      const now = new Date().toISOString();
      await db.update(users)
        .set({ name, updatedAt: now })
        .where(eq(users.id, userId));
    }
    
    // Fetch updated user
    const updatedUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    const userResponse = {
      id: updatedUser[0].id,
      email: updatedUser[0].email,
      name: updatedUser[0].name,
      createdAt: updatedUser[0].createdAt,
      updatedAt: updatedUser[0].updatedAt
    };
    
    return c.json({
      success: true,
      message: 'Profile updated successfully',
      user: userResponse
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ error: 'Profile update failed' }, 500);
  }
});

export default auth;