export type CoingeckoToken = {
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

export const formatCoingeckoToken = (
    token: CoingeckoToken & { tweetMentions: number }
): string => {
    const symbolWithPrefix = token.symbol.startsWith("$")
        ? token.symbol
        : `$${token.symbol}`;

    return [
        `${token.name} (${symbolWithPrefix})`,
        `Price: $${token.current_price.toLocaleString()}`,
        `Market Cap: $${token.market_cap.toLocaleString()}`,
        `Volume: $${token.total_volume.toLocaleString()}`,
        `24h Price Change: ${token.price_change_percentage_24h.toFixed(
            2
        )}% ($${token.price_change_24h.toLocaleString()})`,
        `24h Market Cap Change: ${token.market_cap_change_percentage_24h.toFixed(
            2
        )}% ($${token.market_cap_change_24h.toLocaleString()})`,
        `Rank: #${token.market_cap_rank}`,
        typeof token.tweetMentions === "number"
            ? `Tweet Mentions: ${token.tweetMentions}`
            : "",
    ].join(" | ");
};

export const getTopTokens = async () => {
    try {
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
        ])) as [CoingeckoToken[], CoingeckoToken[]];

        if (
            !topSolanaTokens ||
            !bitcoinAndEthereum ||
            !Array.isArray(topSolanaTokens) ||
            !Array.isArray(bitcoinAndEthereum)
        ) {
            return [];
        }

        return [...topSolanaTokens, ...bitcoinAndEthereum].map((token) => ({
            ...token,
            isNewToken: false,
        }));
    } catch {
        return [];
    }
};
