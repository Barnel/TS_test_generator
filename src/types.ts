export interface OwnerRepo {
    owner: string;
    repo: string;
}

export interface RepoInfo {
    default_branch: string;
    permissions?: {
        push?: boolean;
        admin?: boolean;
        maintain?: boolean;
    };
}

export interface GitTreeEntry {
    type: string;
    path: string;
}

export interface GitTreeResponse {
    tree: GitTreeEntry[];
}

export interface GitRefResponse {
    object: { sha: string };
}

export interface ContentsResponse {
    sha: string;
}

export interface PullRequestResponse {
    html_url: string;
}
