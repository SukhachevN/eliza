import { IAgentRuntime, State, elizaLogger } from "@elizaos/core";
import { getBitcoinInfo } from "../providers";
import {
    AlloraAPIClient,
    ChainSlug,
    PriceInferenceTimeframe,
    PriceInferenceToken,
} from "@alloralabs/allora-sdk";

export const generateBitcoinPrediction = async (
    runtime: IAgentRuntime,
    state: State
) => {
    try {
        const bitcoinInfo = await getBitcoinInfo();

        if (!bitcoinInfo) {
            elizaLogger.error("Failed to get bitcoin info");
            return;
        }

        const alloraClient = new AlloraAPIClient({
            apiKey: process.env.ALLORA_API_KEY,
        });

        const inference = await alloraClient.getPriceInference(
            PriceInferenceToken.BTC,
            PriceInferenceTimeframe.FIVE_MIN
        );

        const bitcoinPredictedPrice =
            +inference.inference_data.network_inference_normalized;

        const direction =
            bitcoinPredictedPrice >= bitcoinInfo.current_price ? "UP" : "DOWN";

        try {
            const getLastPredictionQuery = `
                SELECT id, direction, bitcoinCurrentPrice, bitcoinPredictedPrice
                FROM "bitcoin-predictions-with-allora"
                WHERE priceRightness = 'NOT CHECKED' AND directionRightness = 'NOT CHECKED'
                ORDER BY createdAt DESC
                LIMIT 1
            `;

            const lastPrediction = await runtime.databaseAdapter.db
                .prepare(getLastPredictionQuery)
                .get();

            if (!!lastPrediction && !!lastPrediction.direction) {
                let directionRightness = "INCORRECT";
                let priceRightness = "INCORRECT";

                if (
                    lastPrediction.direction === "UP" &&
                    bitcoinInfo.current_price >
                        lastPrediction.bitcoinCurrentPrice
                ) {
                    directionRightness = "CORRECT";
                } else if (
                    lastPrediction.direction === "DOWN" &&
                    bitcoinInfo.current_price <
                        lastPrediction.bitcoinCurrentPrice
                ) {
                    directionRightness = "CORRECT";
                }

                const tolerance = parseFloat(
                    process.env.BITCOIN_PREDICTION_TOLERANCE || "0.002"
                );

                const priceDifference = bitcoinInfo.current_price
                    ? Math.abs(
                          bitcoinInfo.current_price -
                              lastPrediction.bitcoinPredictedPrice
                      ) / bitcoinInfo.current_price
                    : 1;

                if (priceDifference <= tolerance) {
                    priceRightness = "CORRECT";
                }

                const updateQuery = `
                    UPDATE "bitcoin-predictions-with-allora"
                    SET directionRightness = ?, priceRightness = ?
                    WHERE id = ?
                    `;

                await runtime.databaseAdapter.db
                    .prepare(updateQuery)
                    .run(directionRightness, priceRightness, lastPrediction.id);
            }
        } catch (error) {
            elizaLogger.error(
                `Failed to check last prediction: ${error?.message}`
            );
        }

        try {
            const query = `
                INSERT INTO "bitcoin-predictions-with-allora" (direction, bitcoinCurrentPrice, bitcoinPredictedPrice, directionRightness, priceRightness)
                VALUES (?, ?, ?, ?, ?)
        `;

            await runtime.databaseAdapter.db
                .prepare(query)
                .run(
                    direction,
                    bitcoinInfo.current_price,
                    bitcoinPredictedPrice,
                    "NOT CHECKED",
                    "NOT CHECKED"
                );
        } catch (error) {
            elizaLogger.error(
                `Error inserting bitcoin prediction: ${error?.message}`
            );
        }
    } catch (error) {
        elizaLogger.error(
            `Error generating bitcoin prediction: ${error?.message}`
        );
    }
};
