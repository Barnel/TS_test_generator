// Hardcoded configuration for the test generator, envs can overwrite some parts of this config.

export const GITHUB_REPO_URL = "https://github.com/Barnel/wild_world";
export const AI_MODEL = "gpt-4o-mini";
export const OUTPUT_DIR = "./generated-tests";
export const REPO_TESTS_DIR = "generated-tests";
export const MAX_FILES = 5;

// Paths tried in order when fetching an LCOV coverage report from the source repository.
// Override with COVERAGE_REPO_PATH env var to specify a custom path.
export const COVERAGE_PATHS_IN_REPO = [
    "coverage/lcov.info",
    "lcov.info",
    "coverage/lcov.dat",
    "coverage.lcov",
];
