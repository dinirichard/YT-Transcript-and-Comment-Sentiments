import { google, youtube_v3 } from "googleapis";
import * as fs from "fs";
import {
    extractCommentData,
    type CommentData,
    type CommentThreadList,
} from "./comments.dto";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["Dbg", "App", "Auth"]);

const keyFile = "./youtube-data-379110-78031f8ee278.json";
const scopes = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]; // Add your required scopes

export async function getCommentData(videoId: string) {
    try {
        if (!fs.existsSync(keyFile)) {
            console.error(".p12 file does NOT exist at:", keyFile);
            process.exit(1);
        }

        // Manually create a JWT client
        const jwtClient = new google.auth.JWT(
            undefined,
            keyFile,
            undefined, // Use the extracted private key
            scopes,
            undefined
        );

        // Authorize the client
        await jwtClient.authorize();

        google.options({ auth: jwtClient });
        console.log("Authentication with p12 successful");

        const youtube = google.youtube("v3");
        let commentThreads: CommentThreadList = await getCommentsThreads(
            youtube,
            videoId
        );

        const commentData: CommentData[] = [];
        commentData.push(...extractCommentData(commentThreads));

        while (commentThreads.nextPageToken) {
            commentThreads = await getCommentsThreads(youtube, videoId, {
                nextPageToken: commentThreads.nextPageToken,
            });
            commentData.push(...extractCommentData(commentThreads));
        }
        logger.debug`Comment Data length: ${commentData.length}`;
        // logger.debug`${commentThreads.items[0].snippet}`;

        return commentData;
    } catch (error) {
        console.error("Authentication failed:", error);
        process.exit(1);
    }
}

async function getCommentsThreads(
    youtube: youtube_v3.Youtube,
    videoId: string,
    options?: { nextPageToken: string }
) {
    if (!options) {
        const response = await youtube.commentThreads.list({
            part: ["snippet", "replies"],
            videoId,
            order: "relevance",
            textFormat: "plainText",
            maxResults: 100,
        });
        return response.data as unknown as CommentThreadList;
    } else {
        const response = await youtube.commentThreads.list({
            part: ["snippet", "replies"],
            videoId,
            pageToken: options.nextPageToken,
            order: "relevance",
            textFormat: "plainText",
            maxResults: 100,
        });
        return response.data as unknown as CommentThreadList;
    }
}
