import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import type { ICredentialVault } from "./DatabaseNode.js";
import type { IPromptProvider, PromptMessage } from "../ai/IPromptProvider.js";
import { AnthropicPromptProvider } from "../ai/AnthropicPromptProvider.js";
import { OpenAIPromptProvider } from "../ai/OpenAIPromptProvider.js";
import { GoogleAIProvider } from "../ai/GoogleAIProvider.js";
import { AIPromptNodeConfigSchema } from "@automation-hub/shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip residual `{{ }}` expression artifacts from resolved string values to
 * prevent prompt-injection from upstream node outputs.
 */
function sanitize(value: string): string {
  return value.replace(/\{\{[^}]*\}\}/g, "[filtered]");
}

function sanitizeMessages(
  messages: Array<{ role: string; content: string }>
): PromptMessage[] {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: sanitize(m.content),
  }));
}

function createProvider(
  provider: "anthropic" | "openai" | "google",
  apiKey: string
): IPromptProvider {
  switch (provider) {
    case "anthropic":
      return new AnthropicPromptProvider(apiKey);
    case "openai":
      return new OpenAIPromptProvider(apiKey);
    case "google":
      return new GoogleAIProvider(apiKey);
  }
}

/**
 * Light-weight JSON schema validation — checks type and required fields only.
 * Full AJV validation is intentionally skipped to avoid heavy deps; the key
 * contract (right shape returned) is verified here.
 */
function validateAgainstJsonSchema(
  data: unknown,
  schema: Record<string, unknown>
): void {
  const schemaType = schema["type"] as string | undefined;

  if (schemaType === "object") {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new AppError(
        "AI response is not an object as required by the JSON schema",
        422,
        "AI_PROMPT_SCHEMA_MISMATCH"
      );
    }
    const required = schema["required"] as string[] | undefined;
    if (required) {
      for (const key of required) {
        if (!(key in (data as object))) {
          throw new AppError(
            `AI response missing required schema field: '${key}'`,
            422,
            "AI_PROMPT_SCHEMA_MISMATCH"
          );
        }
      }
    }
  } else if (schemaType === "array") {
    if (!Array.isArray(data)) {
      throw new AppError(
        "AI response is not an array as required by the JSON schema",
        422,
        "AI_PROMPT_SCHEMA_MISMATCH"
      );
    }
  }
}

// ─── Node ─────────────────────────────────────────────────────────────────────

/** Injectable factory for tests — defaults to the built-in createProvider. */
export type PromptProviderFactory = (
  provider: "anthropic" | "openai" | "google",
  apiKey: string
) => IPromptProvider;

export class AIPromptNode implements INode {
  readonly definition: NodeDefinition = {
    type: "ai_prompt",
    name: "AI Prompt Builder",
    description:
      "Build and send structured prompts to LLM providers (Claude, GPT-4o, Gemini) with full message history, few-shot examples, and JSON response validation",
  };

  private readonly providerFactory: PromptProviderFactory;

  constructor(
    private readonly credentialVault?: ICredentialVault,
    providerFactory?: PromptProviderFactory
  ) {
    this.providerFactory = providerFactory ?? createProvider;
  }

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const parsed = AIPromptNodeConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new AppError(
        `AIPromptNode config invalid: ${parsed.error.errors[0]?.message ?? "unknown"}`,
        400,
        "AI_PROMPT_INVALID_CONFIG"
      );
    }

    const {
      provider,
      credentialId,
      model,
      systemPrompt,
      messages,
      responseFormat,
      jsonSchema,
      temperature,
      maxTokens,
      fallbackProvider,
      fallbackCredentialId,
    } = parsed.data;

    if (!this.credentialVault) {
      throw new AppError(
        "Credential vault is not configured for AIPromptNode",
        500,
        "AI_PROMPT_NO_VAULT"
      );
    }

    const cred = await this.credentialVault.getCredentialData(
      context.tenantId,
      credentialId
    );
    const apiKey = cred["apiKey"] ?? cred["api_key"];
    if (!apiKey) {
      throw new AppError(
        "Credential does not contain an 'apiKey' field",
        400,
        "AI_PROMPT_MISSING_KEY"
      );
    }

    const sanitizedMessages = sanitizeMessages(messages);
    const effectiveSystem = systemPrompt ? sanitize(systemPrompt) : undefined;
    const providerConfig = { model, temperature, maxTokens, responseFormat, jsonSchema };

    let rawContent: string;
    let inputTokens: number;
    let outputTokens: number;

    try {
      const result = await this.providerFactory(provider, apiKey).complete(
        effectiveSystem,
        sanitizedMessages,
        providerConfig
      );
      rawContent = result.content;
      inputTokens = result.usage.inputTokens;
      outputTokens = result.usage.outputTokens;
    } catch (primaryErr) {
      if (fallbackProvider && fallbackCredentialId) {
        const fallbackCred = await this.credentialVault.getCredentialData(
          context.tenantId,
          fallbackCredentialId
        );
        const fallbackApiKey = fallbackCred["apiKey"] ?? fallbackCred["api_key"];
        if (!fallbackApiKey) throw primaryErr as Error;

        const fallbackResult = await this.providerFactory(fallbackProvider, fallbackApiKey).complete(
          effectiveSystem,
          sanitizedMessages,
          providerConfig
        );
        rawContent = fallbackResult.content;
        inputTokens = fallbackResult.usage.inputTokens;
        outputTokens = fallbackResult.usage.outputTokens;
      } else {
        throw primaryErr;
      }
    }

    // Parse and optionally validate JSON response
    let content: unknown = rawContent;
    if (responseFormat === "json" || responseFormat === "structured") {
      try {
        content = JSON.parse(rawContent);
      } catch {
        throw new AppError(
          `AI response is not valid JSON: ${rawContent.slice(0, 200)}`,
          422,
          "AI_PROMPT_INVALID_JSON"
        );
      }

      if (responseFormat === "structured" && jsonSchema) {
        validateAgainstJsonSchema(content, jsonSchema);
      }
    }

    return {
      data: {
        content,
        rawContent,
        provider,
        model,
        responseFormat,
      },
      metadata: {
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      },
    };
  }
}
