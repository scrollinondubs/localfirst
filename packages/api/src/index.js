import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createDatabase } from './db/index.js';
import businessesRoutes from './routes/businesses.js';
import chainsRoutes from './routes/chains.js';
import analyticsRoutes from './routes/analytics.js';
import authRoutes from './routes/auth.js';

const app = new Hono();

// Database middleware - attach db instance to context
app.use('*', async (c, next) => {
  c.set('db', createDatabase(c.env));
  await next();
});

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:3000',  // Mobile app dev server
      'chrome-extension://*',   // Chrome extension
      /^https:\/\/.*\.pages\.dev$/, // Cloudflare Pages (production mobile app)
      'https://mobile.localfirst.site', // Production mobile app custom domain
      'https://d353d22c.localfirst-mobile.pages.dev', // Current Pages deployment
    ],
    credentials: true,
  })
);

// Health check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Local First Arizona API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/businesses', businessesRoutes);
app.route('/api/chains', chainsRoutes);
app.route('/api/analytics', analyticsRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;