import { serve } from '@hono/node-server';
import { config } from 'dotenv';
import app from './src/index.js';

// Load environment variables from .env file
config();

const port = 8787;

// Mock environment object for development
const mockEnv = {
  NODE_ENV: 'development',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL || 'file:./local.db',
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