// Entrypoint for the testforge test generator.
//
// Generates unit tests for TypeScript files in a hardcoded GitHub repository
// using an AI provider (OpenAI), then pushes the generated tests to a new
// branch and opens a pull request.
//
// Usage:
//   1. npm install
//   2. export OPENAI_API_KEY=sk-...
//      export GITHUB_TOKEN=ghp_...                 # required for branch/PR creation (repo scope)
//      (optional) export GITHUB_TARGET_REPO=owner/repo  # repo to push branch & open PR against
//                                                       # defaults to the source repo
//                                                       # MUST be writable by your token (e.g. a fork)
//      (optional) export GITHUB_SOURCE_REPO=owner/repo  # override the hardcoded source repo
//   3. npm run generate-tests
//
// Implementation lives in ./src; this file just wires up main().

import { runCli } from "./src/interfaces/cli.js";

runCli().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
