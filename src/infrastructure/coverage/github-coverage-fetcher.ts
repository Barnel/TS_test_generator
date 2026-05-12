import type { CoverageReport } from "../../domain/coverage.js";
import type { OwnerRepoRef, SourceControlPort } from "../../domain/ports.js";
import { COVERAGE_PATHS_IN_REPO } from "../../config.js";
import { LcovCoverageParser } from "./lcov-coverage-parser.js";

export interface FetchedCoverage {
    report: CoverageReport;
    sourcePath: string;
}

export class GithubCoverageFetcher {
    private readonly parser = new LcovCoverageParser();

    constructor(private readonly scm: SourceControlPort) {}

    async fetch(
        ref: OwnerRepoRef,
        branch: string,
        customPath?: string,
    ): Promise<FetchedCoverage | null> {
        const paths = customPath ? [customPath] : COVERAGE_PATHS_IN_REPO;
        for (const p of paths) {
            try {
                const raw = await this.scm.fetchRawFile(ref, branch, p);
                const report = this.parser.parse(raw);
                if (report.files.length > 0) {
                    return { report, sourcePath: p };
                }
            } catch {
                // file not found or not parseable — try next
            }
        }
        return null;
    }
}