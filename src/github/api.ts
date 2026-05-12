import type { OwnerRepo } from "../types.js";

export function parseRepoUrl(url: string): OwnerRepo {
    const match = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
    if (!match) {
        throw new Error(`Invalid GitHub repository URL: ${url}`);
    }
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export function parseOwnerRepo(slug: string): OwnerRepo {
    const parts = slug.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`Invalid GITHUB_TARGET_REPO value: "${slug}". Expected "owner/repo".`);
    }
    return { owner: parts[0], repo: parts[1] };
}

export function ghHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "testforge-test-generator",
    };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
}

export async function ghRequest<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: { ...ghHeaders(), ...((options.headers as Record<string, string>) || {}) },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
            `GitHub API ${options.method || "GET"} ${url} -> ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`,
        );
    }
    return (res.status === 204 ? null : await res.json()) as T;
}

export function encodePath(filePath: string): string {
    return filePath.split("/").map(encodeURIComponent).join("/");
}
