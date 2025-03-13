import {
    // ansiColorFormatter,
    configure,
    getConsoleSink,
    // getLevelFilter,
    getAnsiColorFormatter,
    withFilter,
    getLogger,
} from "@logtape/logtape";
import { getFileSink } from "@logtape/file";
// import { getYoutubeInfo } from "./google.auth";
// import * as utils from "./utils";
// import { Database } from "./database";
// import type { DuckDBResultReader } from "@duckdb/node-api/lib/DuckDBResultReader";
// import type { YoutubeInfo } from "./comments.dto";
import {
    CommentsProcessing,
    ExtractTopicsAndQuestions,
    ProcessYoutubeURL,
} from "./flow";
import { Flow } from "./pocket";

const logger = getLogger(["Dbg", "App", "Main"]);

// declare module "bun" {
//     interface Env {
//         AWESOME: string;
//         YOUTUBE_API_KEY: string;
//         YOUTUBE_ACCESS_TOKEN: string;
//     }
// }

// console.log("Hello via Bun!");
// console.log(Bun.env.YOUTUBE_ACCESS_TOKEN);
// console.log(Bun.env.AWESOME);

// await authenticate();
// console.log("Server running on port 3000");
// console.log("Server running on port 4000");

await (async () => {
    await configure({
        sinks: {
            console: getConsoleSink({
                formatter: getAnsiColorFormatter({
                    timestamp: "time",
                    timestampColor: "cyan",
                }),
            }),
            appLogFile: getFileSink("./log/app.log"),
            errorLogFile: withFilter(getFileSink("./log/error.log"), "error"),
        },
        filters: {
            // noDebug(record) {
            //     return record.level !== 'debug'
            // },
            // onlyErrors(record) {
            //     return record.level === 'error' || record.level === 'fatal'
            // },
            // infoAndAbove: getLevelFilter('info'),
        },
        loggers: [
            {
                category: "Dbg",
                lowestLevel: "debug",
                sinks: ["console", "appLogFile", "errorLogFile"],
            },
            {
                category: ["App", "Err"],
                lowestLevel: "info",
                sinks: ["console", "appLogFile", "errorLogFile"],
            },
        ],
    });
    // Launch the browser and open a new blank page;

    // console.log(Bun.env.YOUTUBE_ACCESS_TOKEN);
    // console.log(Bun.env.AWESOME);

    // const videoId = utils.retrieveVideoId(
    //     "https://www.youtube.com/watch?v=mgoCr7STbh4"
    // );

    // const transcript = await getYoutubeTranscript(videoId);
    // logger.debug`Transcript: ${transcript}`;
    try {
        // const db = await Database.create(); // Use the static factory method
        // // Now you can use the database connection:
        // // const results = await db.query("SELECT 42 AS answer;");
        // await db.createTables();
        // const videoSaved: DuckDBResultReader = await db.queryGet(
        //     `   SELECT 1
        //         FROM videos
        //         WHERE id = '${videoId}';
        //     `
        // );
        // let ddd: DuckDBResultReader = await db.queryGet(
        //     `SELECT * FROM comments;`
        // );
        // logger.debug`Comments: ${ddd}`;
        // if (videoSaved.currentRowCount !== 1) {
        //     const youtubeInfo = await getYoutubeInfo(videoId);
        //     await db.insertVideo(
        //         videoId,
        //         youtubeInfo.videoTitle,
        //         youtubeInfo.thumbnailUrl
        //     );
        //     await db.insertTranscript(videoId, youtubeInfo.transcript);
        //     await db.appendComments(videoId, youtubeInfo.comments);
        //     logger.debug(`Data has been saved.`);
        // } else {
        //     logger.debug(`Video data already exist`);
        //     // c.id AS comment_id,
        //     // c.textDisplay,
        //     // c.parentId,
        //     // c.likeCount,
        //     // c.publishedAt,
        //     // c.totalReplyCount
        //     // LEFT JOIN
        //     //     comments c ON v.id = c.videoId
        //     //     LIMIT
        //     //         5;
        //     ddd = await db.queryGet(`
        //         SELECT
        //             v.id,
        //             v.title,
        //             v.thumbnailUrl,
        //         FROM
        //             videos v
        //         WHERE
        //             v.id = '${videoId}'
        //     `);
        //     logger.debug`Comments Json: ${ddd.getRows()[0][1]}`;
        // }
        // db.close();

        const youtube = new ProcessYoutubeURL(
            "https://www.youtube.com/watch?v=mgoCr7STbh4"
        );
        const yaml = new ExtractTopicsAndQuestions();
        const commentsNode = new CommentsProcessing();
        youtube.addSuccessor(commentsNode);
        const flow = new Flow(youtube);
        const result = await flow.run({});
        logger.debug`flow result: ${result}`;
    } catch (error) {
        logger.error`Error: ${error}`;
    }

    console.log("App shutdown");
})();
