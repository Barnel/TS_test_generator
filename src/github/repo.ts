import type { RepoInfo } from "../types.js";
import { ghRequest } from "./api.js";

export async function getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    return ghRequest<RepoInfo>(`https://api.github.com/repos/${owner}/${repo}`);
}

export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
    const data = await getRepoInfo(owner, repo);
    return data.default_branch;
}

export function canPush(info: RepoInfo): boolean {
    return !!(info.permissions && (info.permissions.push || info.permissions.admin || info.permissions.maintain));
}
