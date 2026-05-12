import type { GitTreeResponse } from "../types.js";
import { encodePath, ghHeaders, ghRequest } from "./api.js";

export async function listTypeScriptFiles(owner: string, repo: string, branch: string): Promise<string[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const data = await ghRequest<GitTreeResponse>(url);
    return data.tree
        .filter(
            (entry) =>
                entry.type === "blob" &&
                entry.path.endsWith(".ts") &&
                !entry.path.endsWith(".d.ts") &&
                !/(^|\/)(test|tests|__tests__|node_modules)\//i.test(entry.path) &&
                !/\.(test|spec)\.ts$/.test(entry.path),
        )
        .map((entry) => entry.path);
}

export async function fetchRawFile(owner: string, repo: string, branch: string, filePath: string): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
        headers: { ...ghHeaders(), Accept: "application/vnd.github.raw" },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Failed to fetch ${filePath}: ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`);
    }
    return await res.text();
}
