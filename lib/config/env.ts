import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1)
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  CRON_SECRET: z.string().trim().min(1),
  FEED_FETCH_CONTACT: z.string().trim().min(1),
  RSS_READING_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  CLOUD_LEARNING_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parsePublicEnv(value: Record<string, string | undefined>): PublicEnv {
  return publicEnvSchema.parse(value);
}

export function parseServerEnv(value: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(value);
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv(process.env);
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}

export function isCloudConfigured(): boolean {
  return publicEnvSchema.safeParse(process.env).success;
}
