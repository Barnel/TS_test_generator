import { parentPort, workerData } from "node:worker_threads";
import OpenAI from "openai";
import { generateTestForFile } from "../../ai/generator.js";

interface WorkerInit {
    apiKey: string;
}

interface WorkerRequest {
    id: number;
    filePath: string;
    sourceCode: string;
}

interface WorkerResponse {
    id: number;
    ok: boolean;
    result?: string;
    error?: string;
}

const init = workerData as WorkerInit;
const client = new OpenAI({ apiKey: init.apiKey });

if (!parentPort) {
    throw new Error("isolated-ai-worker must run as a worker_thread");
}

parentPort.on("message", async (msg: WorkerRequest) => {
    try {
        const result = await generateTestForFile(client, msg.filePath, msg.sourceCode);
        const reply: WorkerResponse = { id: msg.id, ok: true, result };
        parentPort!.postMessage(reply);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const reply: WorkerResponse = { id: msg.id, ok: false, error: message };
        parentPort!.postMessage(reply);
    }
});
