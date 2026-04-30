import type { NodeRegistry } from "./NodeRegistry.js";
import {
  HttpRequestNode,
  WebhookNode,
  ConditionNode,
  JavaScriptNode,
  DelayNode,
  TransformNode,
  SetVariableNode,
  NoOpNode,
  AiTransformNode,
  EmailNode,
  DbQueryNode,
  LoopNode,
  MergeNode,
  SlackNode,
  TelegramNode,
  DiscordNode,
  OpenAINode,
  GitHubNode,
} from "./implementations/index.js";
import type { IAiProvider } from "./contracts/IAiProvider.js";

export function registerBuiltInNodes(
  registry: NodeRegistry,
  aiProvider?: IAiProvider
): void {
  // ── Core nodes ──────────────────────────────────────────────────────────────
  registry.register(new HttpRequestNode());
  registry.register(new WebhookNode());
  registry.register(new ConditionNode());
  registry.register(new JavaScriptNode());
  registry.register(new DelayNode());
  registry.register(new TransformNode());
  registry.register(new SetVariableNode());
  registry.register(new NoOpNode());
  registry.register(new EmailNode());
  registry.register(new DbQueryNode());
  registry.register(new LoopNode());
  registry.register(new MergeNode());

  // AI node requires a provider — skip gracefully if none configured
  if (aiProvider) {
    registry.register(new AiTransformNode(aiProvider));
  }

  // ── Integration nodes (built-in marketplace packages) ──────────────────────
  registry.register(new SlackNode());
  registry.register(new TelegramNode());
  registry.register(new DiscordNode());
  registry.register(new OpenAINode());
  registry.register(new GitHubNode());
}
