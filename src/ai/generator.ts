import OpenAI from "openai";
import { AI_MODEL } from "../config.js";

export function buildPrompt(filePath: string, sourceCode: string): string {
    return `You are a senior TypeScript engineer. Write a thorough unit test file
        for the following TypeScript module using Jest and ts-jest.
        
        Requirements:
        - Output ONLY the contents of the test file. No prose, no markdown fences.
        - Use \`import\` statements (ES modules).
        - Cover the public API: happy paths, edge cases, and error handling.
        - If the module exports nothing testable, output a single comment explaining why.
        
        Source file: ${filePath}
        
        \`\`\`ts
        ${sourceCode}
        \`\`\`
    `;
}

export function stripCodeFences(text: string): string {
    return text
        .replace(/^\s*```(?:ts|typescript|javascript|js)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
}

export async function generateTestForFile(
    openai: OpenAI,
    filePath: string,
    sourceCode: string,
): Promise<string> {
    const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            {
                role: "system",
                content: "You generate high-quality TypeScript unit tests. Respond with code only.",
            },
            { role: "user", content: buildPrompt(filePath, sourceCode) },
        ],
        temperature: 0.2,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    return stripCodeFences(raw);
}
