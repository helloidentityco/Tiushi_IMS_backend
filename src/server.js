import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Absolute top-level initialization of environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Security Headers with Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS Configuration with HttpOnly Cookie Support
const isAllowedOrigin = (origin) => {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)

  ///////////////////////////////////////////uncommment start 
  if (!origin) return true;

  if (config.frontendUrl && origin === config.frontendUrl) return true;

  // Match any localhost or 127.0.0.1 port (e.g. http://localhost:5173, http://localhost:5174, etc.)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  /////////////////////////////////uncommment end 

  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS Error: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body Parsing & Cookie Parsing Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Base Route
app.get('/', (req, res) => {
  res.json({
    name: 'Identity IMS API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/health',
  });
});

// API Routes
app.use('/api', apiRoutes);

// 404 Handler
app.use(notFound);

// Uniform Global Error Handler (must be last in pipeline)
app.use(errorHandler);

// Global process safeguards against unexpected network drops
process.on('unhandledRejection', (reason, promise) => {
  console.warn('⚠️ [Process Safeguard]: Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Process Safeguard]: Uncaught Exception thrown:', err?.message || err);
});

// Start Server
const server = app.listen(config.port, () => {
  console.log(`🚀 [Identity IMS Server] Running on http://localhost:${config.port}`);
  console.log(`🔒 [Security] Helmet & CORS enabled (Origins: ${config.frontendUrl}, http://localhost:*, http://127.0.0.1:*)`);
  console.log(`🍪 [Auth] HttpOnly Cookie exchange enabled with credentials: true`);
});

export default app;
export { server };
