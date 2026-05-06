import { z } from "zod";

export const AIProviderSchema = z.enum(["anthropic", "openai", "google"]);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export const AIResponseFormatSchema = z.enum(["text", "json", "structured"]);
export type AIResponseFormat = z.infer<typeof AIResponseFormatSchema>;

export const AIPromptMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "Message content cannot be empty"),
});
export type AIPromptMessage = z.infer<typeof AIPromptMessageSchema>;

export const AIPromptNodeConfigSchema = z.object({
  provider: AIProviderSchema,
  credentialId: z.string().min(1, "Credential ID is required"),
  model: z.string().min(1, "Model is required"),
  systemPrompt: z.string().optional(),
  messages: z.array(AIPromptMessageSchema).min(1, "At least one message is required"),
  responseFormat: AIResponseFormatSchema.default("text"),
  jsonSchema: z.record(z.unknown()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(16384).optional(),
  stream: z.boolean().optional().default(false),
  fallbackProvider: AIProviderSchema.optional(),
  fallbackCredentialId: z.string().optional(),
});
export type AIPromptNodeConfig = z.infer<typeof AIPromptNodeConfigSchema>;
