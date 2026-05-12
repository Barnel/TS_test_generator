import path from "node:path";
import { OUTPUT_DIR, REPO_TESTS_DIR } from "./config.js";

export function testPathFor(sourcePath: string): string {
    const parsed = path.parse(sourcePath);
    const testFile = `${parsed.name}.test.ts`;
    return path.join(OUTPUT_DIR, parsed.dir, testFile);
}

export function repoTestPathFor(sourcePath: string): string {
    const parsed = path.parse(sourcePath);
    const testFile = `${parsed.name}.test.ts`;
    return [REPO_TESTS_DIR, parsed.dir, testFile].filter(Boolean).join("/").replace(/\/+/g, "/");
}
