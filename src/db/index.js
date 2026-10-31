import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema.js';
import { config } from '../config/env.js';

if (!config.databaseUrl) {
  console.warn(
    '⚠️ [Database Notice]: DATABASE_URL is not set in environment variables. Update your .env file with your Neon PostgreSQL connection string.'
  );
}

// Enable WebSockets for full interactive transaction support in Node.js
if (!neonConfig.webSocketConstructor && typeof globalThis.WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

// Initialize Neon Pool client with WebSocket connection support
export const pool = new Pool({
  connectionString: config.databaseUrl || 'postgresql://placeholder:placeholder@ep-sample.us-east-2.aws.neon.tech/neondb',
});

// Prevent unhandled error events on idle WebSocket connections from crashing the process
pool.on('error', (err, client) => {
  console.error('⚠️ [Neon Database Pool Warning]: Idle client connection event:', err?.message || err);
});

// Initialize Drizzle ORM with schema and serverless connection supporting transactions
export const db = drizzle(pool, { schema });

export { schema };
export default db;
