import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly locate the .env file in the backend root directory
const backendDir = path.resolve(__dirname, '../../');
const backendEnvPath = path.resolve(backendDir, '.env');
const rootEnvPath = path.resolve(backendDir, '../.env');

// 1. Try loading backend/.env
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

// 2. Fallback to process.cwd() or root .env if DATABASE_URL is not yet populated
if (!process.env.DATABASE_URL) {
  dotenv.config(); // default cwd
  if (!process.env.DATABASE_URL && fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
  }
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_dev_only',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || 'hkmimv4d',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '958514274164661',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || 'gQf041UWtO_WFb0iCWUmez2k-Uw',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
