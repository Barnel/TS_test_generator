import type { CoverageReport } from "../coverage.js";
import { filesBelowThreshold } from "../coverage.js";
import { CoverageThreshold } from "../value-objects.js";

export class FilePrioritisationService {
    prioritise(
        files: string[],
        coverage?: CoverageReport,
        threshold: CoverageThreshold = CoverageThreshold.default(),
    ): string[] {
        if (!coverage) return [...files];

        const lowCov = filesBelowThreshold(coverage, threshold.percent);
        if (lowCov.length === 0) return [...files];

        const pctByFile = new Map<string, number>();
        for (const f of lowCov) pctByFile.set(f.file, f.lines.pct);

        const prioritised = files
            .filter((f) => pctByFile.has(f))
            .sort((a, b) => (pctByFile.get(a) ?? 0) - (pctByFile.get(b) ?? 0));
        const rest = files.filter((f) => !pctByFile.has(f));
        return [...prioritised, ...rest];
    }
}
