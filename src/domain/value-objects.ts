export class CoverageThreshold {
    static readonly DEFAULT = 80;

    private constructor(public readonly percent: number) {}

    static of(percent: number): CoverageThreshold {
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
            throw new Error(`Invalid coverage threshold: ${percent}`);
        }
        return new CoverageThreshold(percent);
    }

    static default(): CoverageThreshold {
        return new CoverageThreshold(CoverageThreshold.DEFAULT);
    }
}
