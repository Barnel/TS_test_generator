import type { GitRefResponse } from "../types.js";
import { ghRequest } from "./api.js";

export async function getBranchHeadSha(owner: string, repo: string, branch: string): Promise<string> {
    const data = await ghRequest<GitRefResponse>(
        `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    return data.object.sha;
}

export async function createBranch(
    owner: string,
    repo: string,
    newBranch: string,
    fromSha: string,
): Promise<unknown> {
    return ghRequest(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ref: `refs/heads/${newBranch}`,
            sha: fromSha,
        }),
    });
}

export function makeBranchName(): string {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
    return `testforge/generated-tests-${ts}`;
}
