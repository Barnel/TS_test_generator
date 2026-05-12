import type { Job, JobStatus, NewJob } from "../../domain/job.js";
import type { JobRepository } from "../../domain/ports.js";
import { getDb } from "./sqlite-database.js";

interface Row {
    id: number;
    request_id: number;
    status: JobStatus;
    branch_name: string | null;
    error: string | null;
    files_processed: number;
    files_committed: number;
    coverage_json: string | null;
    created_at: string;
    updated_at: string;
}

function toEntity(row: Row): Job {
    return {
        id: row.id,
        requestId: row.request_id,
        status: row.status,
        branchName: row.branch_name,
        error: row.error,
        filesProcessed: row.files_processed,
        filesCommitted: row.files_committed,
        coverageJson: row.coverage_json,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

const COLUMN_MAP: Record<string, string> = {
    status: "status",
    branchName: "branch_name",
    error: "error",
    filesProcessed: "files_processed",
    filesCommitted: "files_committed",
    coverageJson: "coverage_json",
};

export class SqliteJobRepository implements JobRepository {
    create(job: NewJob): Job {
        const db = getDb();
        const info = db
            .prepare("INSERT INTO jobs (request_id) VALUES (?)")
            .run(job.requestId);
        const id = Number(info.lastInsertRowid);
        const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Row;
        return toEntity(row);
    }

    update(id: number, patch: Partial<Job>): void {
        const entries = Object.entries(patch).filter(
            ([k]) => k in COLUMN_MAP,
        ) as [keyof typeof COLUMN_MAP, unknown][];
        if (entries.length === 0) return;

        const setSql = entries
            .map(([k]) => `${COLUMN_MAP[k]} = ?`)
            .join(", ");
        const values = entries.map(([, v]) => v as string | number | null);

        getDb()
            .prepare(
                `UPDATE jobs SET ${setSql}, updated_at = datetime('now') WHERE id = ?`,
            )
            .run(...values, id);
    }

    findById(id: number): Job | undefined {
        const row = getDb()
            .prepare("SELECT * FROM jobs WHERE id = ?")
            .get(id) as Row | undefined;
        return row ? toEntity(row) : undefined;
    }

    findLatestByRequestId(requestId: number): Job | undefined {
        const row = getDb()
            .prepare(
                "SELECT * FROM jobs WHERE request_id = ? ORDER BY id DESC LIMIT 1",
            )
            .get(requestId) as Row | undefined;
        return row ? toEntity(row) : undefined;
    }

    listByStatus(status: JobStatus): Job[] {
        const rows = getDb()
            .prepare("SELECT * FROM jobs WHERE status = ? ORDER BY id ASC")
            .all(status) as Row[];
        return rows.map(toEntity);
    }
}
