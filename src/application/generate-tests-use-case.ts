import fs from "node:fs/promises";
import path from "node:path";

import type { CoverageReport } from "../domain/coverage.js";
import type {
    AiTestGeneratorPort,
    OwnerRepoRef,
    SourceControlPort,
    TestRequestRepository,
} from "../domain/ports.js";
import { CoverageThreshold } from "../domain/value-objects.js";
import { FilePrioritisationService } from "../domain/services/file-prioritisation-service.js";
import { repoTestPathFor, testPathFor } from "../paths.js";
import { OUTPUT_DIR, MAX_FILES } from "../config.js";
import { makeBranchName } from "../github/branch.js";
import type { JobService } from "./job-service.js";

export interface GenerateTestsInput {
    source: OwnerRepoRef;
    target: OwnerRepoRef;
    sourceRepoUrl: string;
    coverage?: CoverageReport;
    coverageThreshold?: number;
}

export interface GenerateTestsOutcome {
    requestId: number;
    jobId: number;
    branch: string;
    pullRequestUrl: string | null;
    committedFiles: string[];
}

export class GenerateTestsUseCase {
    private readonly prioritisation: FilePrioritisationService;

    constructor(
        private readonly testRequests: TestRequestRepository,
        private readonly jobs: JobService,
        private readonly scm: SourceControlPort,
        private readonly ai: AiTestGeneratorPort,
        private readonly logger: (msg: string) => void = console.log,
        prioritisation: FilePrioritisationService = new FilePrioritisationService(),
    ) {
        this.prioritisation = prioritisation;
    }

    async execute(input: GenerateTestsInput): Promise<GenerateTestsOutcome> {
        const { source, target, sourceRepoUrl } = input;

        const request = this.testRequests.create({ repositoryUrl: sourceRepoUrl });
        this.logger(
            `Recorded test-generation request #${request.id} for ${sourceRepoUrl}`,
        );

        const job = this.jobs.enqueue({ requestId: request.id });

        try {
            const sourceMeta = await this.scm.getRepoMetadata(source);
            const targetMeta = await this.scm.getRepoMetadata(target);
            this.logger(`Source default branch: ${sourceMeta.defaultBranch}`);
            this.logger(`Target default branch: ${targetMeta.defaultBranch}`);

            if (!targetMeta.canPush) {
                throw new Error(
                    `GITHUB_TOKEN has no push access to ${target.owner}/${target.repo}. ` +
                        `Set GITHUB_TARGET_REPO=owner/repo to a repository you can push to.`,
                );
            }

            const allFiles = await this.scm.listTypeScriptFiles(source, sourceMeta.defaultBranch);
            this.logger(`Found ${allFiles.length} TypeScript source files.`);

            const ordered = this.prioritiseByCoverage(allFiles, input);
            const files = ordered.slice(0, MAX_FILES);
            this.logger(`Processing the first ${files.length} file(s)...\n`);

            const branch = makeBranchName();
            await this.scm.createBranch(target, branch, targetMeta.defaultBranch);
            this.jobs.start(job.id, branch);
            if (input.coverage) this.jobs.attachCoverage(job.id, input.coverage);
            this.logger(
                `Created branch ${branch} on ${target.owner}/${target.repo} (from ${targetMeta.defaultBranch}).\n`,
            );

            await fs.mkdir(OUTPUT_DIR, { recursive: true });

            const committedFiles: string[] = [];
            let processed = 0;

            for (const filePath of files) {
                processed++;
                try {
                    this.logger(`→ ${filePath}`);
                    const sourceCode = await this.scm.fetchRawFile(
                        source,
                        sourceMeta.defaultBranch,
                        filePath,
                    );
                    const testCode = await this.ai.generateTestForFile(filePath, sourceCode);

                    const outPath = testPathFor(filePath);
                    await fs.mkdir(path.dirname(outPath), { recursive: true });
                    await fs.writeFile(outPath, testCode, "utf8");
                    this.logger(`  ✓ wrote ${path.relative(process.cwd(), outPath)}`);

                    const repoPath = repoTestPathFor(filePath);
                    await this.scm.commitFile(
                        target,
                        branch,
                        repoPath,
                        testCode,
                        `test: add generated tests for ${filePath}`,
                    );
                    committedFiles.push(repoPath);
                    this.logger(`  ✓ committed ${repoPath} to ${branch}`);
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    this.logger(`  ✗ ${filePath}: ${message}`);
                }
                this.jobs.recordProgress(job.id, processed, committedFiles.length);
            }

            let pullRequestUrl: string | null = null;
            if (committedFiles.length > 0) {
                const prTitle = "Add AI-generated unit tests";
                const prBody = [
                    "This PR adds unit tests automatically generated by testforge.",
                    "",
                    `Source repository: ${source.owner}/${source.repo}@${sourceMeta.defaultBranch}`,
                    "",
                    "Files added/updated:",
                    ...committedFiles.map((p) => `- \`${p}\``),
                ].join("\n");

                const pr = await this.scm.openPullRequest(
                    target,
                    branch,
                    targetMeta.defaultBranch,
                    prTitle,
                    prBody,
                );
                pullRequestUrl = pr.htmlUrl;
                this.testRequests.setPullRequestUrl(request.id, pullRequestUrl);
                this.logger(`\nPull request created: ${pullRequestUrl}`);
            } else {
                this.logger("\nNo files were committed; skipping pull request creation.");
            }

            this.jobs.succeed(job.id);
            return {
                requestId: request.id,
                jobId: job.id,
                branch,
                pullRequestUrl,
                committedFiles,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.jobs.fail(job.id, message);
            throw err;
        }
    }

    private prioritiseByCoverage(
        files: string[],
        input: GenerateTestsInput,
    ): string[] {
        const threshold = input.coverageThreshold !== undefined
            ? CoverageThreshold.of(input.coverageThreshold)
            : CoverageThreshold.default();
        return this.prioritisation.prioritise(files, input.coverage, threshold);
    }
}
