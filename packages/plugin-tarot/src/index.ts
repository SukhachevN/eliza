import { Plugin } from "@elizaos/core";
import { tokensProvider, bitcoinInfoProvider } from "./providers";
import { getTarotPrediction, generateBitcoinPrediction } from "./actions";

export { getTarotPrediction, generateBitcoinPrediction };

export const tarotPlugin: Plugin = {
    name: "tarot",
    description: "Tarot plugin",
    actions: [],
    evaluators: [],
    providers: [tokensProvider, bitcoinInfoProvider],
};
