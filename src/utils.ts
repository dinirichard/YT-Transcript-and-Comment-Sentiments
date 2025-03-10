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
