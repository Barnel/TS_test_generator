export class RepositoryJobQueue {
    private readonly tails = new Map<string, Promise<unknown>>();

    async run<T>(repoKey: string, task: () => Promise<T>): Promise<T> {
        const previous = this.tails.get(repoKey) ?? Promise.resolve();
        const next = previous.then(task, task);
        const tail = next.catch(() => undefined);
        this.tails.set(repoKey, tail);
        try {
            return (await next) as T;
        } finally {
            if (this.tails.get(repoKey) === tail) {
                this.tails.delete(repoKey);
            }
        }
    }
}
