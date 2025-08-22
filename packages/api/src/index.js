import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import businessesRoutes from './routes/businesses.js';
import chainsRoutes from './routes/chains.js';
import analyticsRoutes from './routes/analytics.js';
import authRoutes from './routes/auth.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:8080',
      'http://localhost:8787',
      'chrome-extension://*'
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