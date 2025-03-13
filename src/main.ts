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

    try {
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
