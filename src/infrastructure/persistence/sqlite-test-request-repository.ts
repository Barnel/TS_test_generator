import type { NewTestRequest, TestRequest } from "../../domain/test-request.js";
import type { TestRequestRepository } from "../../domain/ports.js";
import { getDb } from "./sqlite-database.js";

interface Row {
    id: number;
    repository_url: string;
    pull_request_url: string | null;
    created_at: string;
}

function toEntity(row: Row): TestRequest {
    return {
        id: row.id,
        repositoryUrl: row.repository_url,
        pullRequestUrl: row.pull_request_url,
        createdAt: row.created_at,
    };
}

export class SqliteTestRequestRepository implements TestRequestRepository {
    create(req: NewTestRequest): TestRequest {
        const db = getDb();
        const info = db
            .prepare("INSERT INTO test_requests (repository_url) VALUES (?)")
            .run(req.repositoryUrl);
        const id = Number(info.lastInsertRowid);
        const row = db
            .prepare("SELECT * FROM test_requests WHERE id = ?")
            .get(id) as Row;
        return toEntity(row);
    }

    setPullRequestUrl(id: number, url: string): void {
        getDb()
            .prepare("UPDATE test_requests SET pull_request_url = ? WHERE id = ?")
            .run(url, id);
    }

    findById(id: number): TestRequest | undefined {
        const row = getDb()
            .prepare("SELECT * FROM test_requests WHERE id = ?")
            .get(id) as Row | undefined;
        return row ? toEntity(row) : undefined;
    }

    listAll(): TestRequest[] {
        const rows = getDb()
            .prepare("SELECT * FROM test_requests ORDER BY id DESC")
            .all() as Row[];
        return rows.map(toEntity);
    }
}
