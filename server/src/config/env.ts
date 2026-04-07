import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
  poolMin: number;
  poolMax: number;
}

interface JwtConfig {
  secret: string;
  expiresIn: string;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface AppConfig {
  nodeEnv: string;
  port: number;
  appName: string;
  db: DatabaseConfig;
  jwt: JwtConfig;
  bcryptRounds: number;
  corsOrigin: string[];
  logLevel: string;
  logFormat: string;
  rateLimit: RateLimitConfig;
  bodyLimit: string;
}

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appName: process.env.APP_NAME || 'I want to build app similar',

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'edocs_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },

  // Security
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),

  // CORS
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://projexlight.com',
    'https://dev.projexlight.com',
  ],

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',
  logFormat: process.env.LOG_FORMAT || 'dev',

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Body parser
  bodyLimit: process.env.BODY_PARSER_LIMIT || '10mb',
};
