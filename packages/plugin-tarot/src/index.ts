import { Plugin } from "@elizaos/core";
import { coingeckoProvider, dexscreenerProvider } from "./providers";
import { generate, getTarotPrediction } from "./actions";

export { getTarotPrediction };

export const tarotPlugin: Plugin = {
    name: "tarot",
    description: "Tarot plugin",
    actions: [generate],
    evaluators: [],
    providers: [dexscreenerProvider, coingeckoProvider],
};
