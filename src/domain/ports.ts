import type { CoverageReport } from "./coverage.js";
import type { Job, JobStatus, NewJob } from "./job.js";
import type { NewTestRequest, TestRequest } from "./test-request.js";

export interface TestRequestRepository {
    create(req: NewTestRequest): TestRequest;
    setPullRequestUrl(id: number, url: string): void;
    findById(id: number): TestRequest | undefined;
    listAll(): TestRequest[];
}

export interface JobRepository {
    create(job: NewJob): Job;
    update(
        id: number,
        patch: Partial<
            Pick<
                Job,
                | "status"
                | "branchName"
                | "error"
                | "filesProcessed"
                | "filesCommitted"
                | "coverageJson"
            >
        >,
    ): void;
    findById(id: number): Job | undefined;
    findLatestByRequestId(requestId: number): Job | undefined;
    listByStatus(status: JobStatus): Job[];
}

export interface OwnerRepoRef {
    owner: string;
    repo: string;
}

export interface RepoMetadata {
    defaultBranch: string;
    canPush: boolean;
}

export interface OpenedPullRequest {
    htmlUrl: string;
}

export interface SourceControlPort {
    getRepoMetadata(ref: OwnerRepoRef): Promise<RepoMetadata>;
    listTypeScriptFiles(ref: OwnerRepoRef, branch: string): Promise<string[]>;
    fetchRawFile(ref: OwnerRepoRef, branch: string, path: string): Promise<string>;
    createBranch(ref: OwnerRepoRef, newBranch: string, fromBranch: string): Promise<void>;
    commitFile(
        ref: OwnerRepoRef,
        branch: string,
        path: string,
        content: string,
        message: string,
    ): Promise<void>;
    openPullRequest(
        ref: OwnerRepoRef,
        head: string,
        base: string,
        title: string,
        body: string,
    ): Promise<OpenedPullRequest>;
}

export interface AiTestGeneratorPort {
    generateTestForFile(filePath: string, sourceCode: string): Promise<string>;
}

export interface CoverageParserPort {
    parse(raw: string): CoverageReport;
}
