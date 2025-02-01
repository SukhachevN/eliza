type TokenProfile = {
    url: string;
    chainId: string;
    tokenAddress: string;
    icon: string;
    header: string;
    description: string;
    links: {
        type: string;
        label: string;
        url: string;
    }[];
};

export type DexscreenerToken = {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    quoteToken: {
        address: string;
        name: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
        m5: {
            buys: number;
            sells: number;
        };
        h1: {
            buys: number;
            sells: number;
        };
        h6: {
            buys: number;
            sells: number;
        };
        h24: {
            buys: number;
            sells: number;
        };
    };
    volume: {
        h24: number;
        h6: number;
        h1: number;
        m5: number;
    };
    priceChange: {
        m5: number;
        h1: number;
        h6: number;
        h24: number;
    };
    liquidity: {
        usd: number;
        base: number;
        quote: number;
    };
    fdv: number;
    marketCap: number;
    pairCreatedAt: number;
    info: {
        imageUrl: string;
        header: string;
        openGraph: string;
        websites: string[];
        socials: {
            type: string;
            url: string;
        }[];
    };
    boosts: {
        active: number;
    };
};

export const formatDexscreenerToken = (
    token: DexscreenerToken & { tweetMentions: number }
) => {
    const symbol = token.baseToken.symbol;
    const symbolWithPrefix = symbol.startsWith("$") ? symbol : `$${symbol}`;

    return `${token.baseToken.name} (${symbolWithPrefix})
    Price: $${Number(token.priceUsd).toLocaleString()}
    Volume (24h): $${Number(token.volume.h24).toLocaleString()}
    Market Cap: $${Number(token.marketCap).toLocaleString()}
    Price Change (24h): %${token.priceChange.h24.toLocaleString()}
    Tweet Mentions: ${token.tweetMentions}`;
};

export const getNewTokens = async () => {
    try {
        const latestTokensResponse = await fetch(
            "https://api.dexscreener.com/token-boosts/top/v1"
        );

        const latestTokens =
            (await latestTokensResponse.json()) as TokenProfile[];

        const solanaTokensAddresses = latestTokens.reduce((acc, token) => {
            if (
                token.chainId === "solana" &&
                token.description &&
                acc.length < 30
            ) {
                acc.push(token.tokenAddress);
            }
            return acc;
        }, [] as string[]);

        const solanaTokensResponse = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${solanaTokensAddresses.join(
                ","
            )}`
        );

        const solanaTokens = (await solanaTokensResponse.json()) as {
            pairs: DexscreenerToken[];
        };

        if (!solanaTokens || !Array.isArray(solanaTokens.pairs)) {
            return [];
        }

        const filteredSolanaTokens = solanaTokens.pairs.reduce(
            (acc, token) => {
                const isValidMarketCap =
                    token.marketCap > Number(process.env.MIN_MARKET_CAP);
                const isValidVolume =
                    Math.max(
                        token.volume.h24,
                        token.volume.h6,
                        token.volume.h1,
                        token.volume.m5
                    ) > Number(process.env.MIN_VOLUME);

                if (isValidMarketCap && isValidVolume) {
                    acc.push({
                        ...token,
                        isNewToken: true,
                        market_cap_change_percentage_24h: token.priceChange.h24,
                        symbol: token.baseToken.symbol,
                    });
                }
                return acc;
            },
            [] as (DexscreenerToken & {
                isNewToken: boolean;
                market_cap_change_percentage_24h: number;
                symbol: string;
            })[]
        );

        return filteredSolanaTokens;
    } catch {
        return [];
    }
};
