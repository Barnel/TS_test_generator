import type { ContentsResponse } from "../types.js";
import { encodePath, ghHeaders, ghRequest } from "./api.js";

export async function getExistingFileSha(
    owner: string,
    repo: string,
    filePath: string,
    branch: string,
): Promise<string | null> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, { headers: ghHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Failed to check ${filePath}: ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`);
    }
    const data = (await res.json()) as ContentsResponse;
    return data.sha;
}

export async function commitFile(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
    content: string,
    message: string,
): Promise<unknown> {
    const existingSha = await getExistingFileSha(owner, repo, filePath, branch);
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(filePath)}`;
    const body: Record<string, string> = {
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
    };
    if (existingSha) body.sha = existingSha;

    return ghRequest(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}
