import * as dotenv from "dotenv";
dotenv.config();
//Helper function to throw error if a variable is missing or undefined
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Environment variable ${key} is not set`);
  return value;
}
//Typed config object
export const env = {
  port: Number(process.env.PORT ?? 3000),
  redis: {
    host: requireEnv("REDIS_HOST"),
    port: Number(requireEnv("REDIS_PORT")),
  },
  cloudinary: {
    cloudName: requireEnv("CLOUDINARY_CLOUD_NAME"),
    apiKey: requireEnv("CLOUDINARY_API_KEY"),
    apiSecret: requireEnv("CLOUDINARY_API_SECRET"),
  },
} as const;
// as const assertion ensures that the env object is treated as a constant type,
// preserving the literal types of its properties for better type safety.
