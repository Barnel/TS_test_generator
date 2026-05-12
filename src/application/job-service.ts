import type { CoverageReport } from "../domain/coverage.js";
import type { Job, NewJob } from "../domain/job.js";
import type { JobRepository } from "../domain/ports.js";

export class JobService {
    constructor(private readonly jobs: JobRepository) {}

    enqueue(req: NewJob): Job {
        return this.jobs.create(req);
    }

    start(id: number, branchName: string): void {
        this.jobs.update(id, { status: "running", branchName });
    }

    recordProgress(
        id: number,
        filesProcessed: number,
        filesCommitted: number,
    ): void {
        this.jobs.update(id, { filesProcessed, filesCommitted });
    }

    attachCoverage(id: number, report: CoverageReport): void {
        this.jobs.update(id, { coverageJson: JSON.stringify(report) });
    }

    succeed(id: number): void {
        this.jobs.update(id, { status: "succeeded" });
    }

    fail(id: number, error: string): void {
        this.jobs.update(id, { status: "failed", error });
    }

    get(id: number): Job | undefined {
        return this.jobs.findById(id);
    }
}
