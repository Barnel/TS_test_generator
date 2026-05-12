import OpenAI from "openai";
import type { AiTestGeneratorPort } from "../../domain/ports.js";
import { generateTestForFile } from "../../ai/generator.js";

export class OpenAiTestGenerator implements AiTestGeneratorPort {
    private readonly client: OpenAI;

    constructor(apiKey: string) {
        this.client = new OpenAI({ apiKey });
    }

    generateTestForFile(filePath: string, sourceCode: string): Promise<string> {
        return generateTestForFile(this.client, filePath, sourceCode);
    }
}
