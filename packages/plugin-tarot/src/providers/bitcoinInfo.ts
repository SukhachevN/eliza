import { IAgentRuntime, Provider } from "@elizaos/core";
import { CoingeckoToken, formatCoingeckoToken } from "./coingecko";

export const getBitcoinInfo = async () => {
    try {
        const response = await fetch(
            "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum"
        );

        const data = (await response.json()) as CoingeckoToken[];

        return data[0] as CoingeckoToken & { tweetMentions: number };
    } catch {
        return null;
    }
};
