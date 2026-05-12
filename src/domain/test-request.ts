export interface TestRequest {
    id: number;
    repositoryUrl: string;
    pullRequestUrl: string | null;
    createdAt: string;
}

export interface NewTestRequest {
    repositoryUrl: string;
}
