import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { GitHubNode } from "../../nodes/implementations/GitHubNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

const BASE_CONFIG = {
  token: "ghp_test",
  owner: "acme",
  repo: "my-repo",
};

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn<() => Promise<unknown>>().mockResolvedValue(body),
    text: jest.fn<() => Promise<string>>().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe("GitHubNode", () => {
  const node = new GitHubNode();
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("github");
  });

  it("throws when token is missing", async () => {
    await expect(
      node.execute({}, { owner: "a", repo: "b", operation: "getRepo" }, ctx)
    ).rejects.toThrow("GitHub: token is required");
  });

  it("throws when owner is missing", async () => {
    await expect(
      node.execute({}, { token: "tok", repo: "b", operation: "getRepo" }, ctx)
    ).rejects.toThrow("GitHub: owner is required");
  });

  it("throws when repo is missing", async () => {
    await expect(
      node.execute({}, { token: "tok", owner: "a", operation: "getRepo" }, ctx)
    ).rejects.toThrow("GitHub: repo is required");
  });

  it("throws when operation is missing", async () => {
    await expect(
      node.execute({}, { token: "tok", owner: "a", repo: "b" }, ctx)
    ).rejects.toThrow("GitHub: operation is required");
  });

  it("getRepo: GETs /repos/owner/repo with Bearer auth", async () => {
    const repoData = { id: 1, full_name: "acme/my-repo" };
    fetchSpy.mockResolvedValue(mockJsonResponse(200, repoData));

    const output = await node.execute(
      {},
      { ...BASE_CONFIG, operation: "getRepo" },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/my-repo",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer ghp_test" }),
      })
    );
    expect(output.data).toEqual(repoData);
  });

  it("listIssues: GETs /repos/owner/repo/issues?state=open&per_page=30", async () => {
    const issues = [{ number: 1, title: "Bug" }];
    fetchSpy.mockResolvedValue(mockJsonResponse(200, issues));

    const output = await node.execute(
      {},
      { ...BASE_CONFIG, operation: "listIssues" },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/my-repo/issues?state=open&per_page=30",
      expect.anything()
    );
    expect(output.data).toEqual(issues);
  });

  it("createIssue: POSTs to /repos/owner/repo/issues", async () => {
    const created = { number: 42, title: "New bug" };
    fetchSpy.mockResolvedValue(mockJsonResponse(201, created));

    const output = await node.execute(
      {},
      {
        ...BASE_CONFIG,
        operation: "createIssue",
        issueTitle: "New bug",
        issueBody: "Description here",
        issueLabels: ["bug"],
      },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/my-repo/issues",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(
      ((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body) as string
    ) as Record<string, unknown>;
    expect(body["title"]).toBe("New bug");
    expect(body["labels"]).toEqual(["bug"]);
    expect(output.data).toEqual(created);
  });

  it("createComment: POSTs to /repos/owner/repo/issues/:number/comments", async () => {
    const comment = { id: 7, body: "LGTM" };
    fetchSpy.mockResolvedValue(mockJsonResponse(201, comment));

    const output = await node.execute(
      {},
      {
        ...BASE_CONFIG,
        operation: "createComment",
        issueNumber: 5,
        commentBody: "LGTM",
      },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/my-repo/issues/5/comments",
      expect.objectContaining({ method: "POST" })
    );
    expect(output.data).toEqual(comment);
  });

  it("listPullRequests: GETs /repos/owner/repo/pulls", async () => {
    const prs = [{ number: 3, title: "Feature" }];
    fetchSpy.mockResolvedValue(mockJsonResponse(200, prs));

    const output = await node.execute(
      {},
      { ...BASE_CONFIG, operation: "listPullRequests" },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/my-repo/pulls?state=open&per_page=30",
      expect.anything()
    );
    expect(output.data).toEqual(prs);
  });

  it("getFile: GETs /repos/owner/repo/contents/path?ref=branch", async () => {
    const file = { name: "README.md", content: "aGVsbG8=" };
    fetchSpy.mockResolvedValue(mockJsonResponse(200, file));

    const output = await node.execute(
      {},
      {
        ...BASE_CONFIG,
        operation: "getFile",
        filePath: "README.md",
        branch: "develop",
      },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/my-repo/contents/README.md?ref=develop",
      expect.anything()
    );
    expect(output.data).toEqual(file);
  });

  it("getFile: defaults to 'main' branch when not specified", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(200, {}));

    await node.execute(
      {},
      { ...BASE_CONFIG, operation: "getFile", filePath: "index.ts" },
      ctx
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("?ref=main"),
      expect.anything()
    );
  });

  it("throws AppError on non-ok GET response", async () => {
    fetchSpy.mockResolvedValue(mockJsonResponse(404, { message: "Not Found" }));

    await expect(
      node.execute({}, { ...BASE_CONFIG, operation: "getRepo" }, ctx)
    ).rejects.toThrow("GitHub 404");
  });

  it("throws AppError on unknown operation", async () => {
    await expect(
      node.execute({}, { ...BASE_CONFIG, operation: "unknownOp" }, ctx)
    ).rejects.toThrow("GitHub: unknown operation 'unknownOp'");
  });
});
