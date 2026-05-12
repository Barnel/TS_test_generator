import type { CoverageReport } from "../domain/coverage.js";
import { filesBelowThreshold } from "../domain/coverage.js";
import { CoverageThreshold } from "../domain/value-objects.js";

export class CoverageReportCommand {
    run(report: CoverageReport, threshold: number = CoverageThreshold.DEFAULT): void {
        const { total } = report;

        console.log("\nCoverage Report");
        console.log("─".repeat(72));
        console.log(
            `  Lines     : ${total.lines.pct}%` +
                ` (${total.lines.covered}/${total.lines.total})`,
        );
        console.log(
            `  Functions : ${total.functions.pct}%` +
                ` (${total.functions.covered}/${total.functions.total})`,
        );
        console.log(
            `  Branches  : ${total.branches.pct}%` +
                ` (${total.branches.covered}/${total.branches.total})`,
        );
        console.log(`\nFiles below ${threshold}% line coverage:`);

        const below = filesBelowThreshold(report, threshold);
        if (below.length === 0) {
            console.log(`  All ${report.files.length} file(s) meet the ${threshold}% threshold.`);
        } else {
            const sorted = [...below].sort((a, b) => a.lines.pct - b.lines.pct);
            for (const f of sorted) {
                console.log(`  ${formatPct(f.lines.pct)}  ${f.file}`);
            }
            console.log(
                `\n${below.length} of ${report.files.length} file(s) below ${threshold}% threshold.`,
            );
        }
    }
}

function formatPct(pct: number): string {
    return `${pct.toFixed(2).padStart(6)}%`;
}