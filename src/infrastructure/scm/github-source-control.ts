import type {
    OpenedPullRequest,
    OwnerRepoRef,
    RepoMetadata,
    SourceControlPort,
} from "../../domain/ports.js";
import { canPush, getDefaultBranch, getRepoInfo } from "../../github/repo.js";
import { fetchRawFile, listTypeScriptFiles } from "../../github/files.js";
import { createBranch, getBranchHeadSha } from "../../github/branch.js";
import { commitFile } from "../../github/commit.js";
import { createPullRequest } from "../../github/pr.js";

export class GithubSourceControl implements SourceControlPort {
    async getRepoMetadata(ref: OwnerRepoRef): Promise<RepoMetadata> {
        const info = await getRepoInfo(ref.owner, ref.repo);
        return {
            defaultBranch: info.default_branch,
            canPush: canPush(info),
        };
    }

    async listTypeScriptFiles(ref: OwnerRepoRef, branch: string): Promise<string[]> {
        return listTypeScriptFiles(ref.owner, ref.repo, branch);
    }

    async fetchRawFile(ref: OwnerRepoRef, branch: string, p: string): Promise<string> {
        return fetchRawFile(ref.owner, ref.repo, branch, p);
    }

    async createBranch(
        ref: OwnerRepoRef,
        newBranch: string,
        fromBranch: string,
    ): Promise<void> {
        const baseSha = await getBranchHeadSha(ref.owner, ref.repo, fromBranch);
        await createBranch(ref.owner, ref.repo, newBranch, baseSha);
    }

    async commitFile(
        ref: OwnerRepoRef,
        branch: string,
        p: string,
        content: string,
        message: string,
    ): Promise<void> {
        await commitFile(ref.owner, ref.repo, branch, p, content, message);
    }

    async openPullRequest(
        ref: OwnerRepoRef,
        head: string,
        base: string,
        title: string,
        body: string,
    ): Promise<OpenedPullRequest> {
        const pr = await createPullRequest(ref.owner, ref.repo, head, base, title, body);
        return { htmlUrl: pr.html_url };
    }
}
