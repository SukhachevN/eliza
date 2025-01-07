import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";

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

type Token = {
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

const dexscreenerProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        const newSolanaTokens =
            await _runtime.cacheManager.get("new-solana-tokens");

        if (newSolanaTokens) {
            return newSolanaTokens;
        }

        const latestTokensResponse = await fetch(
            "https://api.dexscreener.com/token-profiles/latest/v1"
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
            pairs: Token[];
        };

        const filteredSolanaTokens = solanaTokens.pairs.filter((token) => {
            const isValidMarketCap =
                token.marketCap > Number(process.env.MIN_MARKET_CAP);
            const isValidVolume =
                Math.max(
                    token.volume.h24,
                    token.volume.h6,
                    token.volume.h1,
                    token.volume.m5
                ) > Number(process.env.MIN_VOLUME);
            const now = new Date().getTime();
            const pairCreatedAt = new Date(token.pairCreatedAt).getTime();
            const ageInHours = (now - pairCreatedAt) / (1000 * 60 * 60);
            const isValidAge =
                ageInHours >= Number(process.env.MIN_AGE) &&
                ageInHours <= Number(process.env.MAX_AGE);

            return isValidMarketCap && isValidVolume && isValidAge;
        });

        if (filteredSolanaTokens.length === 0) {
            return "";
        }

        const result = `
        New tokens on Solana:\n
        ${filteredSolanaTokens
            .map(
                (token) =>
                    `${token.baseToken.name} ($${token.baseToken.symbol})
                    Price: $${Number(token.priceUsd).toLocaleString()}
                    Volume (24h): $${Number(token.volume.h24).toLocaleString()}
                    Market Cap: $${Number(token.marketCap).toLocaleString()}
                    Price Change (24h): %${token.priceChange.h24.toLocaleString()}`
            )
            .join("\n\n")}
        `;

        await _runtime.cacheManager.set("new-solana-tokens", result, {
            expires:
                new Date().getTime() +
                Number(process.env.REFETCH_INTERVAL) * 60 * 1000,
        });

        return result;
    },
};
export { dexscreenerProvider };
