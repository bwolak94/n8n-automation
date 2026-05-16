import { z } from "zod";

export const CredentialType = {
  GENERIC: "generic",
  HTTP_BASIC: "http_basic",
  BEARER: "bearer",
  OAUTH2: "oauth2",
  SMTP: "smtp",
  DATABASE_DSN: "database_dsn",
} as const;

export type CredentialTypeValue = (typeof CredentialType)[keyof typeof CredentialType];

export const CredentialTypeSchema = z.enum([
  "generic",
  "http_basic",
  "bearer",
  "oauth2",
  "smtp",
  "database_dsn",
]);

export const CredentialCreateSchema = z.object({
  name: z.string().min(1).max(255),
  type: CredentialTypeSchema,
  data: z.record(z.string()),
});

export const CredentialUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  data: z.record(z.string()).optional(),
});

export const CredentialResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: CredentialTypeSchema,
  createdAt: z.coerce.date(),
});

export type CredentialCreate = z.infer<typeof CredentialCreateSchema>;
export type CredentialUpdate = z.infer<typeof CredentialUpdateSchema>;
export type CredentialResponse = z.infer<typeof CredentialResponseSchema>;
