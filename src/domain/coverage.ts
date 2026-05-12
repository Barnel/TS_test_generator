export interface CoverageMetric {
    total: number;
    covered: number;
    pct: number;
}

export interface FileCoverage {
    file: string;
    lines: CoverageMetric;
    statements: CoverageMetric;
    functions: CoverageMetric;
    branches: CoverageMetric;
}

export interface CoverageReport {
    total: {
        lines: CoverageMetric;
        statements: CoverageMetric;
        functions: CoverageMetric;
        branches: CoverageMetric;
    };
    files: FileCoverage[];
}

export function filesBelowThreshold(
    report: CoverageReport,
    threshold: number,
): FileCoverage[] {
    return report.files.filter((f) => f.lines.pct < threshold);
}
