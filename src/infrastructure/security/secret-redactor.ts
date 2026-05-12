const PATTERNS: RegExp[] = [
    /sk-[A-Za-z0-9_-]{16,}/g, // OpenAI API keys
    /ghp_[A-Za-z0-9]{20,}/g, // GitHub classic PATs
    /github_pat_[A-Za-z0-9_]{20,}/g, // GitHub fine-grained PATs
    /gho_[A-Za-z0-9]{20,}/g, // GitHub OAuth tokens
    /ghs_[A-Za-z0-9]{20,}/g, // GitHub server-to-server tokens
];

const dynamicSecrets = new Set<string>();

export function registerSecret(value: string | undefined | null): void {
    if (value && value.length >= 8) dynamicSecrets.add(value);
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redact(text: string): string {
    let out = text;
    for (const pat of PATTERNS) out = out.replace(pat, "***REDACTED***");
    for (const secret of dynamicSecrets) {
        out = out.replace(new RegExp(escapeRegex(secret), "g"), "***REDACTED***");
    }
    return out;
}
