import { getLogger } from "@logtape/logtape";
import { BaseNode, DEFAULT_ACTION } from "./pocket";
import * as utils from "./utils";
import { Database } from "./database";
import type { DuckDBResultReader } from "@duckdb/node-api/lib/DuckDBResultReader";
import { getYoutubeInfo } from "./google.auth";
import type { CommentData, YoutubeInfo } from "./comments.dto";
import yaml from "yaml";
import { createBatchEmbeddings } from "./utils";
import type { ContentEmbedding } from "@google/generative-ai";

const logger = getLogger(["Dbg", "App", "Flw"]);

export class ProcessYoutubeURL extends BaseNode {
    private url: string;
    constructor(url: string) {
        super();
        this.url = url;
    }

    _clone(): BaseNode {
        return new ProcessYoutubeURL(this.url);
    }

    async prep(sharedState: any): Promise<any> {
        logger.info`Setup database and process youtube url for video Id.`;
        const videoId = utils.retrieveVideoId(this.url);
        const db = await Database.create();
        await db.createTables();
        sharedState.videoId = videoId;
        sharedState.db = db;
        return { videoId, db };
    }

    async execCore(prepResult: any): Promise<any> {
        if (!prepResult) {
            throw new Error("Method not implemented.");
        }

        logger.info`Proccesing Youtube Url ${prepResult.videoId}`;
        const videoSaved: DuckDBResultReader = await prepResult.db.queryGet(
            `   SELECT 1
                        FROM videos
                        WHERE id = '${prepResult.videoId}';
                    `
        );

        let youtubeInfo: YoutubeInfo;
        if (videoSaved.currentRowCount !== 1) {
            youtubeInfo = await getYoutubeInfo(prepResult.videoId);

            await prepResult.db.insertVideo(
                prepResult.videoId,
                youtubeInfo.videoTitle,
                youtubeInfo.thumbnailUrl
            );
            await prepResult.db.insertTranscript(
                prepResult.videoId,
                youtubeInfo.transcript
            );
            await prepResult.db.appendComments(
                prepResult.videoId,
                youtubeInfo.comments
            );
            logger.debug(`Data has been saved.`);
        } else {
            logger.debug(`Video data already exist`);
            const videoInfo: DuckDBResultReader = await prepResult.db.queryGet(`
                    SELECT
                        v.id,
                        v.title,
                        v.thumbnailUrl,
                    FROM
                        videos v
                    WHERE
                        v.id = '${prepResult.videoId}';
                `);

            const videoComments: DuckDBResultReader = await prepResult.db
                .queryGet(`
                    SELECT
                        c.commentId,
                        c.textDisplay,
                        c.parentId,
                        c.likeCount,
                        c.publishedAt,
                        c.totalReplyCount
                    FROM
                        comments c
                    WHERE
                        c.videoId = '${prepResult.videoId}';
            `);

            const videoTranscript: DuckDBResultReader = await prepResult.db
                .queryGet(`
                    SELECT
                        t.original,
                    FROM
                        transcripts t
                    WHERE
                        t.videoId = '${prepResult.videoId}';
            `);
            youtubeInfo = {
                videoId: videoInfo.getRows()[0][0] as string,
                videoTitle: videoInfo.getRows()[0][1] as string,
                thumbnailUrl: videoInfo.getRows()[0][2] as string,
                transcript: videoTranscript.getRows()[0][0] as string,
                comments:
                    videoComments.getRowsJson() as unknown as CommentData[],
            };
        }

        return youtubeInfo;
    }
    async post(
        prepResult: any,
        execResult: YoutubeInfo,
        sharedState: any
    ): Promise<string> {
        sharedState.youtubeInfo = execResult;
        return DEFAULT_ACTION;
    }
}

export class ExtractTopicsAndQuestions extends BaseNode {
    _clone(): BaseNode {
        return new ExtractTopicsAndQuestions();
    }
    prep(sharedState: any): Promise<string> {
        const prompt: string = `
            You are an expert content analyzer. Given a YouTube video transcript, identify at least 2 or more most interesting topics discussed and generate at most 3 most thought-provoking questions for each topic.
            These questions don't need to be directly asked in the video. It's good to have clarification questions.

            VIDEO TITLE: ${sharedState.youtubeInfo.title}

            TRANSCRIPT:
            ${sharedState.youtubeInfo.transcript}

            Format your response in YAML:

            \`\`\`yaml
            topics:
                - title: |
                    First Topic Title
                  questions:
                    -   |
                        Question 1 about first topic?
                    -   |
                        Question 2 ...
                - title: |
                    Second Topic Title
                  questions:
                        ...
            \`\`\`
        `;

        return Promise.resolve(prompt);
    }

    async execCore(prepResult: string): Promise<any> {
        const response = await utils.callLLM(prepResult);
        logger.debug`llm response: ${response}`;
        const yamlContent = utils.extractYamlContent(response);

        const parsed = yaml.parse(yamlContent);
        logger.debug`Parsed yaml: ${parsed}`;
        const parentChild: string[] = [];
        parsed.topics.forEach(
            (element: { title: string; questions: string[] }) => {
                parentChild.push(element.title);
                element.questions.forEach((question) => {
                    parentChild.push(question);
                });
            }
        );

        const transcriptEmbeddings: ContentEmbedding[] =
            await createBatchEmbeddings(parentChild);
        logger.debug`Parsed yaml: ${parentChild}`;
        return { parsed, parentChild, transcriptEmbeddings };
    }

    async post(
        prepResult: any,
        execResult: {
            parsed: any;
            parentChild: string[];
            transcriptEmbeddings: ContentEmbedding[];
        },
        sharedState: any
    ): Promise<string> {
        const transEmbedTable: DuckDBResultReader =
            await sharedState.db.queryGet(
                `SELECT *
                    FROM transcripts_embeddings
                    WHERE videoId = '${sharedState.videoId}';
            `
            );

        logger.debug`transEmbedTable: ${transEmbedTable}`;

        if (transEmbedTable.currentRowCount === 0) {
            let parentIndex = 0;
            await execResult.parsed.topics.forEach(
                async (element: { title: string; questions: string[] }) => {
                    const titleId = utils.makeId(11);
                    parentIndex++;
                    await sharedState.db.connect.run(
                        `
                        insert into transcripts_embeddings (id, videoId, text, embedding)
                            values (?, ?, ?, list_value(${execResult.transcriptEmbeddings[parentIndex - 1].values.map(() => "?").join(", ")}));
                        `,
                        [
                            titleId,
                            sharedState.videoId as string,
                            element.title,
                            ...execResult.transcriptEmbeddings[parentIndex - 1]
                                .values,
                        ]
                    );
                    element.questions.forEach(async (question) => {
                        parentIndex++;
                        const questionId = utils.makeId(11);
                        await sharedState.db.connect.run(
                            `
                            insert into transcripts_embeddings (id, videoId, parentId, text, embedding)
                                values (?, ?, ?, ?, list_value(${execResult.transcriptEmbeddings[parentIndex - 1].values.map(() => "?").join(", ")}));
                            `,
                            [
                                titleId + "." + questionId,
                                sharedState.videoId as string,
                                titleId,
                                question,
                                ...execResult.transcriptEmbeddings[
                                    parentIndex - 1
                                ].values,
                            ]
                        );
                    });
                }
            );

            logger.info`Inserted transcript embeddings.`;
        } else {
            logger.info`Transcript embeddings have already been generated and saved.`;
        }

        return DEFAULT_ACTION;
    }
}

export class CommentsProcessing extends BaseNode {
    _clone(): BaseNode {
        return new CommentsProcessing();
    }

    async prep(sharedState: any): Promise<any> {
        const transEmbedTable: DuckDBResultReader =
            await sharedState.db.queryGet(
                `SELECT commentId, textDisplay
                    FROM comments
                    WHERE videoId = '${sharedState.videoId}' AND (parentId IS NULL OR parentId = '');
            `
            );

        const parentComments = transEmbedTable.getRows();
        const yamlOutput = [];

        for (const parent of parentComments) {
            const repliesRes: DuckDBResultReader =
                await sharedState.db.queryGet(
                    `
                        SELECT textDisplay
                        FROM comments
                        WHERE parentId = '${parent[0]}'
                    `
                );

            const replies = repliesRes.getRows();
            const commentEntry: { mainComment: string; replies?: string[] } = {
                mainComment: parent[1] as string,
            };

            if (replies.length > 0) {
                commentEntry.replies = replies.map(
                    (reply) => reply[0] as string
                );
            }

            yamlOutput.push(commentEntry);
        }

        const commEmbedTable: DuckDBResultReader =
            await sharedState.db.queryGet(
                `SELECT *
                    FROM comments_embeddings
                    WHERE videoId = '${sharedState.videoId}';
            `
            );

        logger.debug`commEmbedTable: ${commEmbedTable}`;
        logger.debug`parentComments length: ${parentComments.length}`;
        logger.debug`yamlOutput length: ${yamlOutput.length}`;

        return {
            parentComments,
            parentChildComments: yamlOutput,
            embeddExists: commEmbedTable.currentRowCount,
        };
    }

    async execCore(prepResult: any): Promise<any> {
        logger.debug`Start embedding parent child comments`;

        if (prepResult.embeddExists > 0) {
            logger.info`Comments embeddings have already been generated and saved.`;
            return [];
        }

        const yamlComments: string[] = prepResult.parentChildComments.map(
            (comments: { mainComment: string; replies?: string[] }) =>
                yaml.stringify(comments)
        );
        logger.debug`yamlComments: ${yamlComments.length}`;

        const commentEmbeddings: ContentEmbedding[] =
            await createBatchEmbeddings(yamlComments);

        logger.debug`commentEmbeddings: ${commentEmbeddings.length}`;
        logger.info`Retrieved comments embeddings.`;
        return commentEmbeddings;
    }
    async post(
        prepResult: any,
        execResult: ContentEmbedding[],
        sharedState: any
    ): Promise<string> {
        if (prepResult.embeddExists > 0) {
            logger.info`Comments embeddings have already been generated and saved.`;
            return DEFAULT_ACTION;
        }

        for (let i = 0; i < execResult.length; i++) {
            const yamlComments: string[] = prepResult.parentChildComments.map(
                (comments: { mainComment: string; replies?: string[] }) =>
                    yaml.stringify(comments)
            );
            await sharedState.db.connect.run(
                `
                            insert into comments_embeddings (videoId, commentId, text, embedding)
                                values (?, ?, ?, list_value(${execResult[i].values.map(() => "?").join(", ")}));
                            `,
                [
                    sharedState.videoId as string,
                    prepResult.parentComments[i][0] as string,
                    yamlComments[i],
                    ...execResult[i].values,
                ]
            );
        }
        return DEFAULT_ACTION;
    }
}
