import { Plugin } from "@elizaos/core";
import { coingeckoProvider, dexscreenerProvider } from "./providers";
import { generate } from "./actions";

export const tarotPlugin: Plugin = {
    name: "tarot",
    description: "Tarot plugin",
    actions: [generate],
    evaluators: [],
    providers: [dexscreenerProvider, coingeckoProvider],
};
