import { IAgentRuntime } from "@elizaos/core";

type TweetScoutResponse = {
    tweets: {
        created_at: string;
    }[];
    next_cursor: string;
};

export const countTweetMentions = async (
    query: string,
    runtime: IAgentRuntime
) => {
    const cache = await runtime.cacheManager.get(`1-tweet-mentions-${query}`);

    if (cache) return cache;

    let totalTweets = 0;
    let nextCursor = "";
    const cutoffTime = new Date(
        Date.now() - Number(process.env.TWEET_LAST_MINUTES ?? 0) * 60 * 1000
    );

    try {
        do {
            const response = await fetch(
                "https://api.tweetscout.io/v2/search-tweets",
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        ApiKey: process.env.TWEETSCOUT_API_KEY as string,
                    },
                    body: JSON.stringify({
                        query,
                        ...(nextCursor && { cursor: nextCursor }),
                    }),
                }
            );

            const data = (await response.json()) as
                | TweetScoutResponse
                | { message: string };

            if (!("tweets" in data)) {
                console.log(data);
                break;
            }

            const lastTweetDate = new Date(
                data.tweets[data.tweets.length - 1]?.created_at
            );

            if (lastTweetDate < cutoffTime) {
                totalTweets += data.tweets.filter(
                    (tweet) => new Date(tweet.created_at) >= cutoffTime
                ).length;
                break;
            }

            totalTweets += data.tweets.length;
            nextCursor = data.next_cursor;

            if (
                process.env.MAX_TWEETS_COUNT &&
                totalTweets >= Number(process.env.MAX_TWEETS_COUNT)
            ) {
                break;
            }
        } while (nextCursor);

        await runtime.cacheManager.set(
            `tweet-mentions-${query}`,
            totalTweets.toString(),
            {
                expires:
                    new Date().getTime() +
                    Number(process.env.REFETCH_INTERVAL) * 60 * 1000,
            }
        );

        return totalTweets;
    } catch {
        return totalTweets;
    }
};
