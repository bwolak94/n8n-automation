import { z } from "zod";

export const DatabaseDialectSchema = z.enum(["postgres", "mysql", "sqlite"]);
export type DatabaseDialect = z.infer<typeof DatabaseDialectSchema>;

export const DatabaseOperationSchema = z.enum(["query", "insert", "update", "delete", "execute"]);
export type DatabaseOperation = z.infer<typeof DatabaseOperationSchema>;

export const DatabaseNodeConfigSchema = z.object({
  dialect:      DatabaseDialectSchema.default("postgres"),
  credentialId: z.string().min(1),
  operation:    DatabaseOperationSchema.default("query"),
  sql:          z.string().min(1),
  params:       z.array(z.unknown()).optional(),
  maxRows:      z.number().int().positive().default(1000),
  transaction:  z.boolean().default(false),
  camelCase:    z.boolean().default(false),
});

export type DatabaseNodeConfig = z.infer<typeof DatabaseNodeConfigSchema>;
