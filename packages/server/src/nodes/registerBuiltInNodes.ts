import type { NodeRegistry } from "./NodeRegistry.js";
import {
  ScheduleTriggerNode,
  HttpRequestNode,
  WebhookNode,
  WebhookTriggerNode,
  ConditionNode,
  JavaScriptNode,
  DelayNode,
  TransformNode,
  SetVariableNode,
  NoOpNode,
  AiTransformNode,
  EmailNode,
  DbQueryNode,
  DatabaseNode,
  ConditionalNode,
  LoopNode,
  MergeNode,
  SubWorkflowNode,
  WaitNode,
  DataTransformNode,
  FunctionNode,
  AIPromptNode,
  FileStorageNode,
  ApprovalNode,
  SlackNode,
  TelegramNode,
  DiscordNode,
  OpenAINode,
  GitHubNode,
} from "./implementations/index.js";
import type { ICredentialVault } from "./implementations/index.js";
import type { ISubWorkflowRunner } from "./implementations/index.js";
import type { IDbClientFactory } from "./implementations/db/DatabaseClientFactory.js";
import type { IAiProvider } from "./contracts/IAiProvider.js";
import type { IWorkflowRepository } from "../engine/types.js";
import type { IBranchSyncManager } from "../engine/BranchSyncManager.js";
import type { IApprovalCreator } from "../modules/approvals/ApprovalService.js";

export interface NodeRegistrationDeps {
  credentialVault?: ICredentialVault;
  dbClientFactory?: IDbClientFactory;
  subWorkflowRunner?: ISubWorkflowRunner;
  workflowRepo?: IWorkflowRepository;
  branchSyncManager?: IBranchSyncManager;
  approvalCreator?: IApprovalCreator;
}

export function registerBuiltInNodes(
  registry: NodeRegistry,
  aiProvider?: IAiProvider,
  nodeDeps?: NodeRegistrationDeps
): void {
  // ── Core nodes ──────────────────────────────────────────────────────────────
  registry.register(new ScheduleTriggerNode());
  registry.register(new HttpRequestNode());
  registry.register(new WebhookNode());
  registry.register(new WebhookTriggerNode());
  registry.register(new ConditionNode());
  registry.register(new JavaScriptNode());
  registry.register(new DelayNode());
  registry.register(new TransformNode());
  registry.register(new SetVariableNode());
  registry.register(new NoOpNode());
  registry.register(new EmailNode());
  registry.register(new DbQueryNode());
  registry.register(new DatabaseNode(nodeDeps?.credentialVault, nodeDeps?.dbClientFactory));
  registry.register(new ConditionalNode());
  registry.register(new LoopNode());
  registry.register(new MergeNode(nodeDeps?.branchSyncManager));
  registry.register(new WaitNode());
  registry.register(new DataTransformNode());
  registry.register(new FunctionNode());
  registry.register(new AIPromptNode(nodeDeps?.credentialVault));
  registry.register(new FileStorageNode(nodeDeps?.credentialVault));
  registry.register(new ApprovalNode(nodeDeps?.approvalCreator));

  // Sub-workflow node requires runner + workflowRepo — skip gracefully if not provided
  if (nodeDeps?.subWorkflowRunner && nodeDeps?.workflowRepo) {
    registry.register(new SubWorkflowNode(nodeDeps.subWorkflowRunner, nodeDeps.workflowRepo));
  }

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
