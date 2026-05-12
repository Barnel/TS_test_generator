import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { COVERAGE_PATHS_IN_REPO, GITHUB_REPO_URL } from "../config.js";
import { parseOwnerRepo, parseRepoUrl } from "../github/api.js";

import { GenerateTestsUseCase } from "../application/generate-tests-use-case.js";
import { JobService } from "../application/job-service.js";

import { SqliteJobRepository } from "../infrastructure/persistence/sqlite-job-repository.js";
import { SqliteTestRequestRepository } from "../infrastructure/persistence/sqlite-test-request-repository.js";
import { GithubSourceControl } from "../infrastructure/scm/github-source-control.js";
import { IsolatedOpenAiTestGenerator } from "../infrastructure/ai/isolated-openai-test-generator.js";
import { OpenAiTestGenerator } from "../infrastructure/ai/openai-test-generator.js";
import { LcovCoverageParser } from "../infrastructure/coverage/lcov-coverage-parser.js";
import { GithubCoverageFetcher } from "../infrastructure/coverage/github-coverage-fetcher.js";
import { registerSecret, redact } from "../infrastructure/security/secret-redactor.js";
import { RepositoryJobQueue } from "../application/repository-job-queue.js";

import { StatusCommand } from "./status-command.js";
import { CoverageReportCommand } from "./coverage-report-command.js";

import type { OwnerRepoRef } from "../domain/ports.js";
import type { CoverageReport } from "../domain/coverage.js";
import { CoverageThreshold } from "../domain/value-objects.js";

function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) {
        console.error(`Error: ${name} environment variable is required.`);
        process.exit(1);
    }
    registerSecret(v);
    return v;
}

const repoQueue = new RepositoryJobQueue();

async function maybeLoadCoverage(): Promise<CoverageReport | undefined> {
    const file = process.env.COVERAGE_FILE;
    if (!file) return undefined;
    try {
        const raw = await fs.readFile(file, "utf8");
        const parser = new LcovCoverageParser();
        const report = parser.parse(raw);
        console.log(
            `Loaded coverage from ${file}: ${report.files.length} files, ` +
                `${report.total.lines.pct}% lines.`,
        );
        return report;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`Warning: failed to load coverage from ${file}: ${message}`);
        return undefined;
    }
}

function printUsage(): void {
    console.log(
        [
            "Usage: testforge <command> [options]",
            "",
            "Commands:",
            "  generate [--detach] [--fetch-coverage]",
            "                      Generate tests, push branch and open PR (default).",
            "                      --detach: runs in the background; track with `testforge status`.",
            "                      --fetch-coverage: fetch the LCOV coverage report from the",
            "                        source repository before generating tests, using it to",
            "                        prioritise files below the coverage threshold.",
            "  coverage-report     Fetch and display the LCOV coverage report from the source",
            "                      repository. Lists files below COVERAGE_THRESHOLD (default 80%).",
            "                      Set COVERAGE_REPO_PATH to specify a custom path in the repo.",
            "  status [<id>]       Show stored requests, job progress, coverage and PR links.",
            "                      Optionally filter by request id.",
            "  help                Show this message.",
        ].join("\n"),
    );
}

function runGenerateDetached(args: string[]): void {
    const entry = path.resolve(process.cwd(), "index.ts");

    const logDir = path.resolve(process.cwd(), "logs");
    fsSync.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(
        logDir,
        `generate-${new Date().toISOString().replace(/[:.]/g, "-")}.log`,
    );
    const out = fsSync.openSync(logPath, "a");
    const err = fsSync.openSync(logPath, "a");

    const forwardArgs = args.filter((a) => a !== "--detach" && a !== "-d");

    // Use the current Node binary with tsx pre-imported as an ESM loader so
    // `.ts` files (and `.js`→`.ts` specifiers) resolve in the child process.
    const child = spawn(
        process.execPath,
        ["--import", "tsx", entry, "generate", ...forwardArgs],
        {
            detached: true,
            stdio: ["ignore", out, err],
            env: process.env,
            cwd: process.cwd(),
        },
    );
    child.on("error", (e) => {
        console.error(`Failed to spawn background process: ${e.message}`);
    });
    child.unref();
    console.log(
        `Started background generation (pid ${child.pid}).\n` +
            `Logs: ${logPath}\n` +
            `Run 'npm run status' to track progress.`,
    );
}

async function maybeFetchCoverageFromRepo(
    scm: GithubSourceControl,
    source: OwnerRepoRef,
): Promise<CoverageReport | undefined> {
    try {
        const sourceMeta = await scm.getRepoMetadata(source);
        const customPath = process.env.COVERAGE_REPO_PATH;
        const fetcher = new GithubCoverageFetcher(scm);
        const result = await fetcher.fetch(source, sourceMeta.defaultBranch, customPath);
        if (!result) {
            const tried = customPath ? [customPath] : COVERAGE_PATHS_IN_REPO;
            console.warn(
                `Warning: --fetch-coverage: no LCOV file found in ` +
                    `${source.owner}/${source.repo}. Tried: ${tried.join(", ")}`,
            );
            return undefined;
        }
        console.log(
            `Fetched coverage from ${result.sourcePath}: ${result.report.files.length} files, ` +
                `${result.report.total.lines.pct}% lines.`,
        );
        return result.report;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`Warning: --fetch-coverage: ${message}`);
        return undefined;
    }
}

async function runGenerate(args: string[]): Promise<void> {
    const fetchCoverage = args.includes("--fetch-coverage");

    const openAiKey = requireEnv("OPENAI_API_KEY");
    requireEnv("GITHUB_TOKEN");

    const source: OwnerRepoRef = process.env.GITHUB_SOURCE_REPO
        ? parseOwnerRepo(process.env.GITHUB_SOURCE_REPO)
        : parseRepoUrl(GITHUB_REPO_URL);
    const target: OwnerRepoRef = process.env.GITHUB_TARGET_REPO
        ? parseOwnerRepo(process.env.GITHUB_TARGET_REPO)
        : source;

    console.log(`Source repository: ${source.owner}/${source.repo}`);
    console.log(`Target repository: ${target.owner}/${target.repo}`);

    const scm = new GithubSourceControl();

    let coverage = await maybeLoadCoverage();
    if (!coverage && fetchCoverage) {
        coverage = await maybeFetchCoverageFromRepo(scm, source);
    }

    const testRequests = new SqliteTestRequestRepository();
    const jobs = new JobService(new SqliteJobRepository());
    const ai = process.env.TESTFORGE_AI_INPROCESS === "1"
        ? new OpenAiTestGenerator(openAiKey)
        : new IsolatedOpenAiTestGenerator(openAiKey);

    const safeLogger = (msg: string) => console.log(redact(msg));

    const useCase = new GenerateTestsUseCase(testRequests, jobs, scm, ai, safeLogger);

    const sourceRepoUrl = `https://github.com/${source.owner}/${source.repo}`;

    const repoKey = `${target.owner}/${target.repo}`;
    const outcome = await repoQueue.run(repoKey, () =>
        useCase.execute({
            source,
            target,
            sourceRepoUrl,
            coverage,
            coverageThreshold: process.env.COVERAGE_THRESHOLD
                ? Number(process.env.COVERAGE_THRESHOLD)
                : undefined,
        }),
    );

    if (ai instanceof IsolatedOpenAiTestGenerator) {
        await ai.dispose();
    }

    if (!outcome.pullRequestUrl) {
        process.exit(1);
    }

    console.log(`Stored PR URL for request #${outcome.requestId} in the database.`);
    console.log(`Job #${outcome.jobId} finished successfully.`);
    console.log(`\nRun 'npm run status' to inspect this and earlier requests.`);
}

async function runCoverageReport(): Promise<void> {
    requireEnv("GITHUB_TOKEN");

    const source: OwnerRepoRef = process.env.GITHUB_SOURCE_REPO
        ? parseOwnerRepo(process.env.GITHUB_SOURCE_REPO)
        : parseRepoUrl(GITHUB_REPO_URL);

    console.log(`Fetching coverage from ${source.owner}/${source.repo}...`);

    const scm = new GithubSourceControl();
    const sourceMeta = await scm.getRepoMetadata(source);

    const customPath = process.env.COVERAGE_REPO_PATH;
    const fetcher = new GithubCoverageFetcher(scm);
    const result = await fetcher.fetch(source, sourceMeta.defaultBranch, customPath);

    if (!result) {
        const tried = customPath ? [customPath] : COVERAGE_PATHS_IN_REPO;
        console.error(`No LCOV coverage file found in ${source.owner}/${source.repo}.`);
        console.error(`Tried paths: ${tried.join(", ")}`);
        console.error(`Set COVERAGE_REPO_PATH to specify a custom path.`);
        process.exit(1);
    }

    console.log(
        `Found coverage at ${result.sourcePath} ` +
            `(${result.report.files.length} files).`,
    );

    const threshold = process.env.COVERAGE_THRESHOLD
        ? Number(process.env.COVERAGE_THRESHOLD)
        : CoverageThreshold.DEFAULT;

    new CoverageReportCommand().run(result.report, threshold);
}

function runStatus(args: string[]): void {
    const idArg = args[0];
    let requestId: number | undefined;
    if (idArg !== undefined) {
        const parsed = Number(idArg);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            console.error(`Invalid request id: ${idArg}`);
            process.exit(1);
        }
        requestId = parsed;
    }

    const cmd = new StatusCommand(
        new SqliteTestRequestRepository(),
        new SqliteJobRepository(),
    );
    cmd.run({ requestId });
}

export async function runCli(): Promise<void> {
    const [command = "generate", ...rest] = process.argv.slice(2);

    switch (command) {
        case "generate":
            if (rest.includes("--detach") || rest.includes("-d")) {
                runGenerateDetached(rest);
                return;
            }
            await runGenerate(rest);
            return;
        case "coverage-report":
            await runCoverageReport();
            return;
        case "status":
            runStatus(rest);
            return;
        case "help":
        case "--help":
        case "-h":
            printUsage();
            return;
        default:
            console.error(`Unknown command: ${command}`);
            printUsage();
            process.exit(1);
    }
}
