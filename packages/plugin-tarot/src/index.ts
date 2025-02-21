import { Plugin } from "@elizaos/core";
import { tokensProvider } from "./providers";
import { getTarotPrediction } from "./actions";

export { getTarotPrediction };

export const tarotPlugin: Plugin = {
    name: "tarot",
    description: "Tarot plugin",
    actions: [],
    evaluators: [],
    providers: [tokensProvider],
};
