import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";

type Token = {
    ath: number;
    ath_change_percentage: number;
    ath_date: string;
    atl: number;
    atl_change_percentage: number;
    atl_date: string;
    circulating_supply: number;
    current_price: number;
    fully_diluted_valuation: number;
    high_24h: number;
    id: string;
    image: string;
    last_updated: string;
    low_24h: number;
    market_cap: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    market_cap_rank: number;
    max_supply: number;
    name: string;
    price_change_24h: number;
    price_change_percentage_24h: number;
    roi: { currency: string; percentage: number; times: number } | null;
    symbol: string;
    total_supply: number;
    total_volume: number;
};

const formatToken = (token: Token): string => {
    return [
        `${token.name} ($${token.symbol.toUpperCase()})`,
        `Price: $${token.current_price.toLocaleString()}`,
        `Market Cap: $${token.market_cap.toLocaleString()}`,
        `Volume: $${token.total_volume.toLocaleString()}`,
        `24h Change: ${token.price_change_percentage_24h.toFixed(2)}% ($${token.price_change_24h.toLocaleString()})`,
        `Rank: #${token.market_cap_rank}`,
    ].join(" | ");
};

const coingeckoProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        const topTokens = await _runtime.cacheManager.get("top-tokens");

        if (topTokens) {
            return topTokens;
        }

        const [topSolanaTokensResponse, bitcoinAndEthereumResponse] =
            await Promise.all([
                fetch(
                    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=solana-meme-coins&per_page=20"
                ),
                fetch(
                    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum"
                ),
            ]);

        const [topSolanaTokens, bitcoinAndEthereum] = (await Promise.all([
            topSolanaTokensResponse.json(),
            bitcoinAndEthereumResponse.json(),
        ])) as [Token[], Token[]];

        const result = [
            "Top Solana Tokens:",
            ...topSolanaTokens.map(formatToken),
            "",
            "Bitcoin and Ethereum:",
            ...bitcoinAndEthereum.map(formatToken),
        ].join("\n");

        await _runtime.cacheManager.set("top-tokens", result, {
            expires: Number(process.env.REFETCH_INTERVAL) * 60 * 1000,
        });

        return result;
    },
};

export { coingeckoProvider };
