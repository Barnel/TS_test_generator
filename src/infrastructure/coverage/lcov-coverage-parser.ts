import type {
    CoverageMetric,
    CoverageReport,
    FileCoverage,
} from "../../domain/coverage.js";
import type { CoverageParserPort } from "../../domain/ports.js";

function metric(total: number, covered: number): CoverageMetric {
    const pct = total === 0 ? 100 : Math.round((covered / total) * 10_000) / 100;
    return { total, covered, pct };
}

function parseInt0(value: string | undefined): number {
    const n = Number.parseInt(value ?? "0", 10);
    return Number.isFinite(n) ? n : 0;
}

export class LcovCoverageParser implements CoverageParserPort {
    parse(raw: string): CoverageReport {
        const files: FileCoverage[] = [];

        const records = raw.split(/^end_of_record\s*$/m);
        for (const record of records) {
            const trimmed = record.trim();
            if (!trimmed) continue;

            const data: Record<string, string> = {};
            for (const line of trimmed.split(/\r?\n/)) {
                const idx = line.indexOf(":");
                if (idx < 0) continue;
                const key = line.slice(0, idx).trim();
                const value = line.slice(idx + 1).trim();
                // Last occurrence wins for repeated keys (LF/LH appear once per file).
                data[key] = value;
            }

            const file = data["SF"];
            if (!file) continue;

            const lf = parseInt0(data["LF"]);
            const lh = parseInt0(data["LH"]);
            const fnf = parseInt0(data["FNF"]);
            const fnh = parseInt0(data["FNH"]);
            const brf = parseInt0(data["BRF"]);
            const brh = parseInt0(data["BRH"]);

            files.push({
                file,
                lines: metric(lf, lh),
                statements: metric(lf, lh),
                functions: metric(fnf, fnh),
                branches: metric(brf, brh),
            });
        }

        const sum = (pick: (f: FileCoverage) => CoverageMetric): CoverageMetric => {
            let total = 0;
            let covered = 0;
            for (const f of files) {
                total += pick(f).total;
                covered += pick(f).covered;
            }
            return metric(total, covered);
        };

        return {
            files,
            total: {
                lines: sum((f) => f.lines),
                statements: sum((f) => f.statements),
                functions: sum((f) => f.functions),
                branches: sum((f) => f.branches),
            },
        };
    }
}
