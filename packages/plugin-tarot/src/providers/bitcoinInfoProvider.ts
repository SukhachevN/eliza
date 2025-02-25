import {
    elizaLogger,
    IAgentRuntime,
    Memory,
    Provider,
    State,
} from "@elizaos/core";
import { CoingeckoToken, formatCoingeckoToken } from "./coingecko";

export const bitcoinInfoProvider: Provider = {
    get: async (_runtime: IAgentRuntime) => {
        try {
            const [bitcoinInfo, bitcoinInfoExpireTime] = await Promise.all([
                _runtime.cacheManager.get("bitcoin-info"),
                _runtime.cacheManager.get("bitcoin-info-expire-time"),
            ]);

            if (
                bitcoinInfo &&
                bitcoinInfoExpireTime &&
                +bitcoinInfoExpireTime > Date.now()
            ) {
                return bitcoinInfo;
            }
            const response = await fetch(
                "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum"
            );

            const data = (await response.json()) as CoingeckoToken[];

            const result = `Bitcoin info: ${formatCoingeckoToken(
                data[0] as CoingeckoToken & { tweetMentions: number }
            )}`;

            await Promise.all([
                _runtime.cacheManager.set("bitcoin-info", result),
                _runtime.cacheManager.set(
                    "bitcoin-info-expire-time",
                    new Date().getTime() +
                        Number(process.env.BITCOIN_INFO_REFETCH_INTERVAL) *
                            60 *
                            1000
                ),
            ]);

            return result;
        } catch {
            return "";
        }
    },
};
