import {
    GoogleGenerativeAI,
    type BatchEmbedContentsRequest,
    type ContentEmbedding,
} from "@google/generative-ai";
import { getLogger } from "@logtape/logtape";
const logger = getLogger(["Dbg", "App", "Utils"]);

/**
 * Retrieve video id from url or string
 * @param videoId video url or video id
 */
export function retrieveVideoId(videoId: string) {
    if (videoId.length === 11) {
        return videoId;
    }

    const regex =
        // eslint-disable-next-line no-useless-escape
        /(?:youtu\.be\/|youtube\.com\/(?:shorts|embed|v|watch\?v=|ytscreeningroom\?v=)|youtube\.com\/(?:.*?[?&]v=))([^"&?\/\s]{11})/i;
    const matchId = videoId.match(regex);

    if (matchId && matchId.length) {
        return matchId[1];
    }

    throw new YoutubeTranscriptError(
        "Impossible to retrieve Youtube video ID."
    );
}

export class YoutubeTranscriptError extends Error {
    constructor(message: string) {
        super(`[YoutubeTranscript] 🚨 ${message}`);
    }
}

export async function callLLM(prompt: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(Bun.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: Bun.env.GEMINI_MODEL! });
    const result = await model.generateContent(prompt);
    logger.debug`LLM result: ${result.response.text()}`;
    logger.debug`LLM result Metadata: ${result.response.usageMetadata}`;
    return result.response.text();
}

export async function createEmbeddings(prompt: string): Promise<number[]> {
    const genAI = new GoogleGenerativeAI(Bun.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: Bun.env.GEMINI_MODEL! });
    const result = await model.embedContent(prompt);
    logger.debug`LLM embedings: ${result.embedding.values}`;
    logger.debug`LLM result Metadata`;
    return result.embedding.values;
}

export async function createBatchEmbeddings(
    contents: string[]
): Promise<ContentEmbedding[]> {
    try {
        const genAI = new GoogleGenerativeAI(Bun.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
            model: Bun.env.GEMINI_EMBED_MODEL!,
        });

        let embedValues: ContentEmbedding[] = [];

        const myBatchGenerator = batchGenerator(contents, 100);

        for (const batch of myBatchGenerator) {
            await Bun.sleep(5000);
            console.log("Processing batch:", batch.length);
            const batchEmbedContentRequest: BatchEmbedContentsRequest = {
                requests: batch.map((text) => ({
                    content: { parts: [{ text }], role: "user" },
                })),
            };
            // logger.debug`Batch request: ${batchEmbedContentRequest.requests}`;

            const result = await model.batchEmbedContents(
                batchEmbedContentRequest
            );

            logger.debug`Embed result: ${result.embeddings.length}`;

            embedValues = [...embedValues, ...result.embeddings];
        }

        logger.debug`LLM result length: ${embedValues.length}`;
        // logger.debug`LLM embedings: ${result.embeddings}`;
        return embedValues;
    } catch (error) {
        logger.error`Error embedding batches of strings: ${error}`;
        throw error;
    }
}

export function extractYamlContent(response: string): string {
    if (response.includes("```yaml")) {
        const parts = response.split("```yaml");
        if (parts.length > 1) {
            const yamlPart = parts[1].split("```");
            if (yamlPart.length > 0) {
                return yamlPart[0].trim();
            }
        }
    }
    return response;
}

function* batchGenerator<T>(
    array: T[],
    batchSize: number
): Generator<T[], void, unknown> {
    if (batchSize <= 0) {
        throw new Error("Batch size must be a positive integer.");
    }

    for (let i = 0; i < array.length; i += batchSize) {
        yield array.slice(i, i + batchSize);
    }
}

export const makeId = (length: number) => {
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < length; i += 1) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};
