# testforge

A backend service that reads TypeScript files from a GitHub repository,
uses an AI provider (OpenAI) to generate Jest unit tests for them, then
pushes the tests to a new branch and opens a pull request. Job state and
each user request are persisted in SQLite. A small CLI dashboard lets you
inspect coverage, job progress, and the resulting PR link.

The codebase is organized in DDD / hexagonal layers:

- **Domain** — entities (`TestRequest`, `Job`, `CoverageReport`) and ports.
- **Application** — use cases (`GenerateTestsUseCase`, `JobService`).
- **Infrastructure** — adapters (SQLite, GitHub REST, OpenAI, lcov parser).
- **Interfaces** — CLI subcommands (`generate`, `status`, `help`).

---

## Setup

### Prerequisites

- Node.js ≥ 18
- npm
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [GitHub personal access token](https://github.com/settings/tokens)
  with `repo` scope (push access to the target repository — typically a
  fork you own)

### Install

```bash
git clone <this-repo>
cd testforge
npm install
```

### Configure environment

Copy the example file and fill in your values:

```bash
cp .env.example .env
# then `export $(grep -v '^#' .env | xargs)` or use a tool like direnv / dotenv
```

| Variable               | Required | Description                                                                                |
|------------------------|----------|--------------------------------------------------------------------------------------------|
| `OPENAI_API_KEY`       | yes      | OpenAI API key used to call `gpt-4o-mini`.                                                 |
| `GITHUB_TOKEN`         | yes      | GitHub token with `repo` scope; must have push access to the target repo.                  |
| `GITHUB_TARGET_REPO`   | no       | `owner/repo` to push the branch and open the PR against. Defaults to the source repo.      |
| `GITHUB_SOURCE_REPO`   | no       | `owner/repo` to read TypeScript files from. Overrides the hardcoded default.               |
| `COVERAGE_FILE`        | no       | Path to an `lcov.info` file. When set, low-coverage files are processed first.             |
| `COVERAGE_THRESHOLD`   | no       | Line-coverage % below which files are prioritised (default: `80`).                         |
| `TESTFORGE_DB_PATH`       | no       | Path to the SQLite DB file (default: `./testforge.db`).                                       |

> Tip: if your token cannot push to the source repo (e.g. it's a public
> repo you don't own), fork it and set `GITHUB_TARGET_REPO=your-user/your-fork`.

---

## Step-by-step guide

### 1. Generate tests and open a PR

Foreground (blocks until PR is opened):

```bash
npm run generate-tests
```

Background (returns immediately; track via `status`):

```bash
npx tsx index.ts generate --detach
```

This will:

1. Validate that the target repo is writable by your token.
2. Optionally parse `COVERAGE_FILE` and prioritise files below
   `COVERAGE_THRESHOLD`.
3. List up to `MAX_FILES` (default `5`) TypeScript files from the source
   repo's default branch.
4. Create a new branch on the target repo (e.g. `testforge/generated-tests-<timestamp>`).
5. For each file: download it, ask OpenAI for a Jest test, write it to
   `./generated-tests/`, and commit it on the new branch.
6. Open a pull request against the target's default branch.
7. Persist the request and job (with PR URL) in SQLite.

### 2. Inspect status

```bash
npm run status              # list all requests
npx tsx index.ts status 3   # details for request #3
```

For each request you'll see:

- Repository URL.
- Latest job: status, files processed / committed, branch, error (if any),
  last updated timestamp.
- Per-file line coverage % (sorted ascending), if a coverage report was
  attached.
- Pull request URL when available.

### 3. Help

```bash
npx tsx index.ts help
```

---

## Architecture diagram

```
        ┌────────────────────────────────────────────┐
        │              Interfaces (CLI)              │
        │   generate  │   status  │   help            │
        └───────────────┬───────────────┬────────────┘
                        │               │
                        ▼               ▼
        ┌────────────────────────────────────────────┐
        │               Application                  │
        │  GenerateTestsUseCase   │   JobService     │
        └───────────────┬───────────────┬────────────┘
                        │  depends only on ports
                        ▼
        ┌────────────────────────────────────────────┐
        │                  Domain                    │
        │  TestRequest │ Job │ CoverageReport        │
        │  Ports: TestRequestRepository,             │
        │         JobRepository, SourceControlPort,  │
        │         AiTestGeneratorPort,               │
        │         CoverageParserPort                 │
        └───────────────┬───────────────┬────────────┘
                        │  implemented by
                        ▼
        ┌────────────────────────────────────────────┐
        │              Infrastructure                │
        │  SQLite repos │ GitHub REST │ OpenAI │ LCOV │
        └────────────────────────────────────────────┘
```

End-to-end flow for `generate`:

```
user ──▶ CLI ──▶ GenerateTestsUseCase ──▶ JobService ──▶ JobRepository (SQLite)
                       │
                       ├──▶ CoverageParserPort  (LCOV → CoverageReport)
                       ├──▶ SourceControlPort   (list/fetch/branch/commit/PR — GitHub)
                       ├──▶ AiTestGeneratorPort (OpenAI → test code)
                       └──▶ TestRequestRepository (SQLite, store PR URL)
```

---

## Domain glossary

- **TestRequest** — a user request to generate tests for a specific
  repository. Persisted with `id`, `repository_url`, `pull_request_url`
  (filled in once the PR is opened), and `created_at`.
- **Job** — a unit of work executing a `TestRequest`. Has a state machine:
  `pending → running → succeeded | failed`. Tracks `branchName`,
  `filesProcessed`, `filesCommitted`, optional `coverageJson`, and
  `error` if it fails.
- **JobStatus** — `pending` | `running` | `succeeded` | `failed`.
- **CoverageReport** — tool-agnostic coverage snapshot: per-file metrics
  (lines / statements / functions / branches) plus totals. Built by a
  `CoverageParserPort` from raw text (currently lcov).
- **OwnerRepoRef** *(value object)* — `{ owner, repo }` reference to a
  GitHub repository, validated on construction (`OwnerRepoRef.parseSlug`,
  `OwnerRepoRef.parseUrl`).
- **RepositoryUrl** *(value object)* — non-empty http(s) URL.
- **CoverageThreshold** *(value object)* — percentage in 0..100 with a
  default of 80; encapsulates the `isBelow(pct)` invariant.
- **BranchName** *(value object)* — git ref-name with character validation.
- **FilePrioritisationService** *(domain service)* — pure logic that
  reorders candidate files so those below `CoverageThreshold` come first
  (sorted ascending by line coverage). Used by `GenerateTestsUseCase`.
- **SourceControlPort** — abstraction over the hosting provider: read
  metadata, list/fetch files, create branches, commit files, open PRs.
  Implemented by `GithubSourceControl`.
- **AiTestGeneratorPort** — abstraction over the AI test generator.
  Implemented by `OpenAiTestGenerator` (in-process) or
  `IsolatedOpenAiTestGenerator` (sandboxed worker_thread, default).
- **CoverageParserPort** — abstraction over coverage formats. Implemented
  by `LcovCoverageParser`.
- **TestRequestRepository / JobRepository** — persistence ports.
  Implemented by `Sqlite*Repository` adapters backed by `testforge.db`.
- **GenerateTestsUseCase** — application service orchestrating the full
  flow (request → coverage → branch → AI → commit → PR → persist).
- **JobService** — application service managing the `Job` lifecycle and
  state transitions.
- **RepositoryJobQueue** — application service that serializes jobs per
  target repository (one job at a time per `owner/repo`, jobs on
  different repos run in parallel).

---

## Non-functional design

### Security: AI sandbox & secret hygiene

- The OpenAI integration runs in a dedicated **worker_thread** with a
  **stripped environment** (`PATH`, `HOME`, optional proxy vars only).
  `GITHUB_TOKEN`, `TESTFORGE_DB_PATH`, `COVERAGE_FILE`, and any other
  parent-process secrets are **not** exposed to the AI sandbox.
  Resource limits cap the worker's heap (`maxOldGenerationSizeMb: 256`).
- Set `TESTFORGE_AI_INPROCESS=1` to opt out (e.g. for debugging); the
  in-process `OpenAiTestGenerator` will be used instead.
- All required env-var values are registered with the
  `secret-redactor`; logs and error messages are scrubbed via `redact()`
  before reaching stdout/stderr (the use-case logger is wrapped).

### Scalability: per-repository serialization

- The CLI runs every `generate` invocation through a process-wide
  `RepositoryJobQueue` keyed by `target.owner/target.repo`. Concurrent
  requests against the same repo are queued (FIFO) so branch creation,
  commits, and PR opening don't race; requests against different repos
  run concurrently.
- The same contract applies if you swap the in-memory implementation for
  a distributed lock (Redis, Postgres advisory lock, ...) in a
  multi-process deployment.

---

## Project layout

```
index.ts                       # entrypoint → src/interfaces/cli.ts
src/
  config.ts                    # constants (repo URL, model, MAX_FILES, ...)
  paths.ts                     # local/repo test path mapping
  types.ts                     # shared GitHub API types
  ai/generator.ts              # OpenAI prompt + call (used by infra adapter)
  github/                      # low-level GitHub REST helpers
  domain/                      # entities, value objects, ports (no I/O)
    value-objects.ts           #   OwnerRepoRef, RepositoryUrl, CoverageThreshold, BranchName
    services/                  #   pure domain services (FilePrioritisationService)
  application/                 # use cases / job service / repo queue
    repository-job-queue.ts    #   per-repo serialization (scalability)
  infrastructure/              # adapters: sqlite, github, openai, lcov, security
    ai/isolated-*.ts           #   sandboxed AI worker_thread (security)
    security/secret-redactor   #   token masking for logs/errors
  interfaces/                  # CLI subcommands (generate, status, help)
```

---

## Scripts

| Command                 | What it does                                      |
|-------------------------|---------------------------------------------------|
| `npm run generate-tests`| Runs the `generate` subcommand (foreground).      |
| `npx tsx index.ts generate --detach` | Runs `generate` in the background.   |
| `npm run status`        | Lists persisted requests and their latest job.    |
| `npm run typecheck`     | `tsc --noEmit` (strict).                          |
| `npm run build`         | Compiles to `./dist`.                             |

---

## Notes

- The local `./generated-tests/` directory mirrors the source layout and
  is always written, in addition to being committed on the PR branch.
- `testforge.db` is created on first run; consider gitignoring it.
