import type { CoverageReport, FileCoverage } from "../domain/coverage.js";
import type { Job } from "../domain/job.js";
import type { JobRepository, TestRequestRepository } from "../domain/ports.js";
import type { TestRequest } from "../domain/test-request.js";

interface RenderOptions {
    requestId?: number;
}

export class StatusCommand {
    constructor(
        private readonly testRequests: TestRequestRepository,
        private readonly jobs: JobRepository,
    ) {}

    run(options: RenderOptions = {}): void {
        const requests = options.requestId !== undefined
            ? this.singleRequest(options.requestId)
            : this.testRequests.listAll();

        if (requests.length === 0) {
            console.log("No test-generation requests found.");
            return;
        }

        for (const req of requests) {
            const job = this.jobs.findLatestByRequestId(req.id);
            this.renderRequest(req, job);
        }
    }

    private singleRequest(id: number): TestRequest[] {
        const req = this.testRequests.findById(id);
        if (!req) {
            console.log(`No request found with id ${id}.`);
            return [];
        }
        return [req];
    }

    private renderRequest(req: TestRequest, job: Job | undefined): void {
        console.log("─".repeat(72));
        console.log(`Request #${req.id}   created ${req.createdAt}`);
        console.log(`  Repository : ${req.repositoryUrl}`);
        console.log(
            `  Pull req.  : ${req.pullRequestUrl ?? "(not available yet)"}`,
        );

        if (!job) {
            console.log("  Job        : (not started)");
            return;
        }

        const progress = `${job.filesCommitted}/${job.filesProcessed} files committed`;
        console.log(
            `  Job        : #${job.id} [${job.status}] ${progress}` +
                (job.branchName ? `  branch=${job.branchName}` : ""),
        );
        console.log(`  Updated    : ${job.updatedAt}`);
        if (job.error) {
            console.log(`  Error      : ${job.error}`);
        }

        const report = parseCoverage(job.coverageJson);
        if (report) {
            console.log("  Coverage   :");
            console.log(
                `    total lines: ${report.total.lines.pct}% ` +
                    `(${report.total.lines.covered}/${report.total.lines.total})`,
            );
            const files = sortByCoverage(report.files);
            for (const f of files) {
                console.log(
                    `    ${formatPct(f.lines.pct)}  ${f.file}`,
                );
            }
        }
    }
}

function parseCoverage(json: string | null): CoverageReport | undefined {
    if (!json) return undefined;
    try {
        return JSON.parse(json) as CoverageReport;
    } catch {
        return undefined;
    }
}

function sortByCoverage(files: FileCoverage[]): FileCoverage[] {
    return [...files].sort((a, b) => a.lines.pct - b.lines.pct);
}

function formatPct(pct: number): string {
    return `${pct.toFixed(2).padStart(6)}%`;
}
