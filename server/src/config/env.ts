import * as dotenv from "dotenv";
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Environment variable ${key} is not set`);
  return value;
}

function optionalEnv(key: string): string | undefined {
  return process.env[key];
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  redis: (() => {
    const url = optionalEnv("REDIS_URL");
    if (url) return { url };

    return {
      host: requireEnv("REDIS_HOST"),
      port: Number(requireEnv("REDIS_PORT")),
    };
  })(),

  cloudinary: {
    cloudName: requireEnv("CLOUDINARY_CLOUD_NAME"),
    apiKey: requireEnv("CLOUDINARY_API_KEY"),
    apiSecret: requireEnv("CLOUDINARY_API_SECRET"),
  },

  frontendUrl: optionalEnv("FRONTEND_URL") ?? "http://localhost:3000",
  jwtSecret: optionalEnv("JWT_SECRET") ?? "dev",
} as const;
