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
import { getCommentData } from "./google.auth";
import * as utils from "./utils";
import { getYoutubeTranscript } from "./transcript";

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
                sinks: ["console", "appLogFile"],
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

    const videoId = utils.retrieveVideoId(
        "https://www.youtube.com/watch?v=mgoCr7STbh4"
    );

    await getCommentData(videoId);
    // const transcript = await getYoutubeTranscript(videoId);
    // logger.debug`Transcript: ${transcript}`;

    console.log("App shutdown");
})();
