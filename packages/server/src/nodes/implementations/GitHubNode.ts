import { AppError } from "../../shared/errors/index.js";
import type { ExecutionContext, INode, NodeDefinition, NodeOutput } from "../contracts/INode.js";

type GitHubOperation =
  | "getRepo"
  | "listIssues"
  | "createIssue"
  | "createComment"
  | "listPullRequests"
  | "getFile";

const BASE = "https://api.github.com";

export class GitHubNode implements INode {
  readonly definition: NodeDefinition = {
    type: "github",
    name: "GitHub",
    description: "Interact with GitHub repositories: issues, pull requests, files, and comments",
    configSchema: {
      type: "object",
      required: ["token", "owner", "repo", "operation"],
      properties: {
        token:     { type: "string", description: "GitHub Personal Access Token" },
        owner:     { type: "string", description: "Repository owner (user or org)" },
        repo:      { type: "string", description: "Repository name" },
        operation: {
          type: "string",
          enum: ["getRepo", "listIssues", "createIssue", "createComment", "listPullRequests", "getFile"],
          description: "Action to perform",
        },
        // createIssue
        issueTitle: { type: "string" },
        issueBody:  { type: "string" },
        issueLabels:{ type: "array", items: { type: "string" } },
        // createComment
        issueNumber: { type: "number" },
        commentBody: { type: "string" },
        // getFile
        filePath:   { type: "string" },
        branch:     { type: "string", default: "main" },
      },
    },
  };

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const token     = config["token"]     as string | undefined;
    const owner     = config["owner"]     as string | undefined;
    const repo      = config["repo"]      as string | undefined;
    const operation = config["operation"] as GitHubOperation | undefined;

    if (!token)     throw new AppError("GitHub: token is required",     400, "GITHUB_MISSING_TOKEN");
    if (!owner)     throw new AppError("GitHub: owner is required",     400, "GITHUB_MISSING_OWNER");
    if (!repo)      throw new AppError("GitHub: repo is required",      400, "GITHUB_MISSING_REPO");
    if (!operation) throw new AppError("GitHub: operation is required", 400, "GITHUB_MISSING_OP");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept:        "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const signal = context.signal ?? AbortSignal.timeout(30_000);

    const get = async (path: string) => {
      const res = await fetch(`${BASE}${path}`, { headers, signal });
      if (!res.ok) throw new AppError(`GitHub ${res.status}: ${await res.text()}`, res.status, "GITHUB_API_ERROR");
      return res.json() as Promise<unknown>;
    };

    const post = async (path: string, body: unknown) => {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) throw new AppError(`GitHub ${res.status}: ${await res.text()}`, res.status, "GITHUB_API_ERROR");
      return res.json() as Promise<unknown>;
    };

    switch (operation) {
      case "getRepo":
        return { data: await get(`/repos/${owner}/${repo}`) };

      case "listIssues":
        return { data: await get(`/repos/${owner}/${repo}/issues?state=open&per_page=30`) };

      case "createIssue":
        return {
          data: await post(`/repos/${owner}/${repo}/issues`, {
            title:  config["issueTitle"],
            body:   config["issueBody"],
            labels: config["issueLabels"] ?? [],
          }),
        };

      case "createComment":
        return {
          data: await post(`/repos/${owner}/${repo}/issues/${config["issueNumber"]}/comments`, {
            body: config["commentBody"],
          }),
        };

      case "listPullRequests":
        return { data: await get(`/repos/${owner}/${repo}/pulls?state=open&per_page=30`) };

      case "getFile": {
        const branch = config["branch"] ?? "main";
        return { data: await get(`/repos/${owner}/${repo}/contents/${config["filePath"]}?ref=${branch}`) };
      }

      default:
        throw new AppError(`GitHub: unknown operation '${operation as string}'`, 400, "GITHUB_UNKNOWN_OP");
    }
  }
}
