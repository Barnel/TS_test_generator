export type JobStatus =
    | "pending"
    | "running"
    | "succeeded"
    | "failed";

export interface Job {
    id: number;
    requestId: number;
    status: JobStatus;
    branchName: string | null;
    error: string | null;
    filesProcessed: number;
    filesCommitted: number;
    coverageJson: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface NewJob {
    requestId: number;
}
