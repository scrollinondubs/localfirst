import { serve } from '@hono/node-server';
import { config } from 'dotenv';
import app from './src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = 8787;

// Mock environment object for development
// Database path: use absolute path to ensure it's always found
// dev-server.js is in packages/api/, so local.db should be in the same directory
const dbPath = process.env.DATABASE_URL || path.resolve(__dirname, 'local.db');
const mockEnv = {
  NODE_ENV: 'development',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  DATABASE_URL: `file:${dbPath}`,
  DB: null // Local SQLite database
};

console.log(`Starting Local First Arizona API on port ${port}...`);
console.log(`OpenAI Key configured: ${mockEnv.OPENAI_API_KEY ? 'Yes' : 'No'}`);

serve({
  fetch: (request, ...args) => {
    // Pass mock environment to the app
    return app.fetch(request, mockEnv, ...args);
  },
  port
});

console.log(`Server is running at http://localhost:${port}`);