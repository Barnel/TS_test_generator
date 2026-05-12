import { Worker } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import type { AiTestGeneratorPort } from "../../domain/ports.js";

interface PendingCall {
    resolve: (s: string) => void;
    reject: (e: Error) => void;
}

interface WorkerResponse {
    id: number;
    ok: boolean;
    result?: string;
    error?: string;
}

export class IsolatedOpenAiTestGenerator implements AiTestGeneratorPort {
    private worker: Worker | null = null;
    private nextId = 1;
    private readonly pending = new Map<number, PendingCall>();
    private readonly apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private ensureWorker(): Worker {
        if (this.worker) return this.worker;
        const here = path.dirname(fileURLToPath(import.meta.url));
        const workerPath = path.join(here, "isolated-ai-worker.ts");
        const workerUrl = pathToFileURL(workerPath).href;

        const sandboxEnv: NodeJS.ProcessEnv = {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            HTTPS_PROXY: process.env.HTTPS_PROXY,
            HTTP_PROXY: process.env.HTTP_PROXY,
            NO_PROXY: process.env.NO_PROXY,
        };

        const bootstrap = `
            import { register } from "tsx/esm/api";
            register();
            await import(${JSON.stringify(workerUrl)});
        `;

        const worker = new Worker(bootstrap, {
            eval: true,
            workerData: { apiKey: this.apiKey },
            env: sandboxEnv,
            resourceLimits: {
                maxOldGenerationSizeMb: 256,
                maxYoungGenerationSizeMb: 64,
            },
        });

        worker.on("message", (msg: WorkerResponse) => {
            const call = this.pending.get(msg.id);
            if (!call) return;
            this.pending.delete(msg.id);
            if (msg.ok && msg.result !== undefined) call.resolve(msg.result);
            else call.reject(new Error(msg.error ?? "AI worker failed"));
        });

        worker.on("error", (err) => {
            for (const [, call] of this.pending) call.reject(err);
            this.pending.clear();
            this.worker = null;
        });

        worker.on("exit", (code) => {
            if (code !== 0) {
                for (const [, call] of this.pending) {
                    call.reject(new Error(`AI worker exited with code ${code}`));
                }
                this.pending.clear();
            }
            this.worker = null;
        });

        this.worker = worker;
        return worker;
    }

    generateTestForFile(filePath: string, sourceCode: string): Promise<string> {
        const w = this.ensureWorker();
        const id = this.nextId++;
        return new Promise<string>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            w.postMessage({ id, filePath, sourceCode });
        });
    }

    async dispose(): Promise<void> {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}
