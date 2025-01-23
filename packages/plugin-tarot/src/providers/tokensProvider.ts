import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";

import {
    DexscreenerToken,
    formatDexscreenerToken,
    getNewTokens,
} from "./dexscreener";
import {
    CoingeckoToken,
    formatCoingeckoToken,
    getTopTokens,
} from "./coingecko";
import { countTweetMentions } from "./countTweetMentions";

export const tokensProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        const tokens = await _runtime.cacheManager.get("tokens");

        if (tokens) return tokens;

        const [newTokens, topTokens] = await Promise.all([
            getNewTokens(),
            getTopTokens(),
        ]);

        const sortedTokens = [...newTokens, ...topTokens].sort(
            (a, b) =>
                Math.abs(b.market_cap_change_percentage_24h) -
                Math.abs(a.market_cap_change_percentage_24h)
        );

        const selectedTokens = sortedTokens.slice(
            0,
            +process.env.TOKENS_FOR_TWEET_COUNT
        );

        const tokensWithMentions = await Promise.all(
            selectedTokens.map(async (token) => {
                const query = token.symbol.startsWith("$")
                    ? token.symbol
                    : `$${token.symbol}`;

                const tweetMentions = await countTweetMentions(query, _runtime);
                return { ...token, tweetMentions };
            })
        );

        const result = `
        Tokens data:\n
        ${tokensWithMentions
            .map((token) =>
                token.isNewToken
                    ? formatDexscreenerToken(
                          token as unknown as DexscreenerToken & {
                              tweetMentions: number;
                          }
                      )
                    : formatCoingeckoToken(
                          token as unknown as CoingeckoToken & {
                              tweetMentions: number;
                          }
                      )
            )
            .join("\n\n")}`;

        await _runtime.cacheManager.set("tokens", result, {
            expires:
                new Date().getTime() +
                Number(process.env.REFETCH_INTERVAL) * 60 * 1000,
        });

        return result;
    },
};
