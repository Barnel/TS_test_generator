import type { PullRequestResponse } from "../types.js";
import { ghRequest } from "./api.js";

export async function createPullRequest(
    owner: string,
    repo: string,
    headBranch: string,
    baseBranch: string,
    title: string,
    body: string,
): Promise<PullRequestResponse> {
    return ghRequest<PullRequestResponse>(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, head: headBranch, base: baseBranch, body }),
    });
}
