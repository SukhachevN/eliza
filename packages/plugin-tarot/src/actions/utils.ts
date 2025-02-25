import { generateText, IAgentRuntime, ModelClass } from "@elizaos/core";
import { insertTarotLog } from "../utils";
import {
    MAJOR_ARCANA,
    MINOR_ARCANA_SUBTYPES,
    MINOR_ARCANA_VALUES,
} from "./constants";

export function generateRandomCards() {
    const cards = [];
    const usedCards = new Set();

    while (cards.length < 3) {
        const isMajorArcana = Math.random() < 0.5;

        if (isMajorArcana) {
            const value =
                MAJOR_ARCANA[Math.floor(Math.random() * MAJOR_ARCANA.length)];
            const cardKey = `major-${value}`;

            if (!usedCards.has(cardKey)) {
                cards.push({
                    type: "major-arcana",
                    value,
                });
                usedCards.add(cardKey);
            }
        } else {
            const subtype =
                MINOR_ARCANA_SUBTYPES[
                    Math.floor(Math.random() * MINOR_ARCANA_SUBTYPES.length)
                ];
            const value =
                MINOR_ARCANA_VALUES[
                    Math.floor(Math.random() * MINOR_ARCANA_VALUES.length)
                ];
            const cardKey = `minor-${subtype}-${value}`;

            if (!usedCards.has(cardKey)) {
                cards.push({
                    type: "minor-arcana",
                    subtype,
                    value,
                });
                usedCards.add(cardKey);
            }
        }
    }

    return cards;
}

export async function generateWithRetry(
    runtime: IAgentRuntime,
    context: string,
    maxAttempts: number = 3,
    exactWordsToCheck: string[] = [],
    isWithLogs: boolean = true
) {
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const prediction = await generateText({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

            const isExactWordsPresent =
                !exactWordsToCheck?.length ||
                exactWordsToCheck.some((word) =>
                    prediction.toLowerCase().includes(word.toLowerCase())
                );

            if (!isExactWordsPresent) {
                isWithLogs &&
                    insertTarotLog(
                        runtime.databaseAdapter.db,
                        `Exact words not found in the prediction: ${exactWordsToCheck.join(
                            ", "
                        )}\n\nPrediction: ${prediction}`
                    );
                throw new Error("Exact words not found in the prediction");
            }

            if (!prediction) {
                isWithLogs &&
                    insertTarotLog(
                        runtime.databaseAdapter.db,
                        "Empty prediction received"
                    );
                throw new Error("Empty prediction received");
            }

            return prediction;
        } catch (error) {
            attempts++;

            if (attempts >= maxAttempts) {
                isWithLogs &&
                    insertTarotLog(
                        runtime.databaseAdapter.db,
                        `Failed to generate valid prediction after ${maxAttempts} attempts due error: ${
                            (error as Error).message
                        }`
                    );
            }
        }
    }
}
