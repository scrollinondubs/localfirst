import { serve } from '@hono/node-server';
import app from './src/index.js';

const port = 8787;

console.log(`Starting Local First Arizona API on port ${port}...`);

serve({
  fetch: app.fetch,
  port
});

console.log(`Server is running at http://localhost:${port}`);