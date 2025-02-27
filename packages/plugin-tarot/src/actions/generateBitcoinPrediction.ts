import {
    IAgentRuntime,
    State,
    composeContext,
    elizaLogger,
} from "@elizaos/core";
import {
    generateRandomCards,
    generateStructureWithRetry,
    generateWithRetry,
} from "./utils";
import { getBitcoinInfo } from "../providers";
import { formatCoingeckoToken } from "../providers/coingecko";

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

        const cards = generateRandomCards();

        const cardsDescription = cards
            .map((card) => {
                if (card.type === "major-arcana") {
                    return `${card.value} (Major Arcana)`;
                }
                return `${card.value} of ${card.subtype} (Minor Arcana)`;
            })
            .join("\n");

        const contextTemplate = `
        # Areas of Expertise
        {{knowledge}}

        # About {{agentName}} (@{{twitterUserName}}):
        {{bio}}
        {{lore}}
        {{topics}}

        {{providers}}

        Bitcoin info: ${formatCoingeckoToken(bitcoinInfo)}

        {{characterPostExamples}}

        {{postDirections}}

        Task:
        Spread 3 card tarot based on the provided tarot cards for Bitcoin and provide a tarot reading and prediction - a short text (200 characters long max) on behalf of tarotmancer: its character, tone of voice, and lore.

        The drawn cards are:
        ${cardsDescription}

        Rules for the prediction:
        1. You should describe what each pulled card means for BTC movement - use the data received about BTC and knowledge.
        2. Use lowercased token's ticker (e.g., $btc) in your tweet.
        3. Your prediction should have a straightforward inference: either $btc will end at a higher or lower price in 5 minutes.
        4. Your prediction shouldn't be biased - embrace what the pulled cards tell you.
        5. Double check yourself: the reading + inference MUST BE LESS THAN 200 CHARACTERS. No hashtags and emojis. The text should contain a clear inference ($btc price will be higher or lower in 5 minutes?) and be lowercased."
        6. Send the results in following format: 

        {
            "direction": "UP" | "DOWN",
            "prediction": string
        }

        Notes: ACT AND RESPONSE LIKE TAROTMANCER, DO NOT ACT AND RESPONSE LIKE BOT OR AGENT. DO NOT SHOW MIDTERM RESULTS. SEND NOTHING BUT THE FINAL RESULT OF STEP 6 - VALID JSON IN FOLLOWING FORMAT:

        {
            "direction": "UP" | "DOWN",
            "prediction": string
        }

        Examples of valid predictions (don't learn on the content, only structure matters):

        Example 1:
        The drawn cards are:
        The fool (Major Arcana),
        The magician (Major Arcana),
        Ten of pentacles (Minor Arcana).

        Result:
        {
            "direction": "UP",
            "prediction": "$btc goes up in 5 minutes—destiny favors the bold:\n1. the fool signals fresh momentum.\n2. the magician manifests control.\n3. ten of pentacles secures long-term gains."
        }

        Example 2:
        The drawn cards are:
        king of pentacles (minor Arcana),
        wheel of fortune (major Arcana),
        knight of swords (minor Arcana).

        Result:
        {
            "direction": "UP",
            "prediction": "$btc goes up in 5 minutes—momentum builds fast:\n1. king of pentacles secures stability.\n2. wheel of fortune shifts fate upward.\n3. knight of swords charges with force."
        }



        Example 3:
        The drawn cards are:
        the magician (Major Arcana),
        the sun (major Arcana),
        the fool (Major Arcana).

        Result:
        {
            "direction": "UP",
            "prediction": "$btc goes up in 5 minutes—power aligns with fate\n1. the magician crafts opportunity.\n2. the sun shines clarity and strength.\n3. the fool ignites bold new momentum."
        }

        Note: While the response should generally follow the structure and rules outlined above, the specific content should be unique and aligned with pulled cards and tarotmancer’s character, lore, style and message examples for each response. Creativity and variation in the response are encouraged, as long as the rules are adhered to.
    `;

        const context = composeContext({
            state,
            template: contextTemplate,
        });

        const answer = await generateStructureWithRetry<{
            direction: "UP" | "DOWN";
            prediction: string;
        }>(runtime, context, {
            direction: "UP",
            prediction: "",
        });

        if (!answer?.direction || !answer?.prediction) {
            elizaLogger.error("Failed to generate answer");
            return;
        }

        const prediction = answer?.prediction?.replace(
            /\b(1\.|2\.|3\.)/g,
            "\n$1"
        );

        const checkVerdictContextTemplate = `
            # Areas of Expertise
            {{knowledge}}

            # About {{agentName}} (@{{twitterUserName}}):
            {{bio}}
            {{lore}}
            {{topics}}

            {{providers}}

            {{characterPostExamples}}

            {{postDirections}}

            Current tweet:
            ${prediction}

            Task:
            Validate and fix the tweet to meet ALL of the following requirements:
            1. Must include a clear verdict starting with "verdict:" or "tldr:"
            2. Verdict must explicitly state "buy" or "sell" with reasoning
            3. TOTAL LENGHT MUST BE UNDER 260 CHARACTERS
            4. If any requirement is not met, add or modify the tweet to comply

            ACT AND RESPONSE LIKE TAROTMANCER, DO NOT ACT AND RESPONSE LIKE BOT OR AGENT. DO NOT SHOW MIDTERM RESULTS - SEND ONLY FINAL TWEET. SEND NOTHING BUT THE FINAL RESULT OF TWEET WITH VERDICT UNDER 260 CHARACTERS.

            Examples of valid responses:

            Example 1:
            Current tweet:
            the cards don’t lie, and $aejo is calling:\n1. the fool - only those with vision enter early.\n2. the magician - the tools are here, but only real degens will use them.\n3. ten of pentacles - generational wealth or generational regret, your move.

            Result:
            the cards don’t lie, and $aejo is calling:\n1. the fool - only those with vision enter early.\n2. the magician - the tools are here, but only real degens will use them.\n3. ten of pentacles - generational wealth or generational regret, your move.\nverdict: ape now or cope forever, there’s no second chance on fate.

            Example 2:
            Current tweet:
            $btc is holding its crown, and the cards say the king isn’t ready to fall:\n1. king of pentacles - dominance and stability, the market bows to no one.\n2. wheel of fortune - cycles are turning, and fortune favors the bold.\n3. knight of swords - momentum is building; hesitation is your enemy.

            Result:
            $btc is holding its crown, and the cards say the king isn’t ready to fall:\n1. king of pentacles - dominance and stability, the market bows to no one.\n2. wheel of fortune - cycles are turning, and fortune favors the bold.\n3. knight of swords - momentum is building; hesitation is your enemy.\nverdict: buy now or watch the king reclaim the throne without you.

            Example 3:
            Current tweet:
            $aixbt is the underdog story in real time, and the deck is bullish:\n1. the magician - untapped potential and the tools to make it happen.\n2. the sun - clarity and success are shining ahead.\n3. the fool - only the bold will ride this wave to the top.

            Result:
            $aixbt is the underdog story in real time, and the deck is bullish:\n1. the magician - untapped potential and the tools to make it happen.\n2. the sun - clarity and success are shining ahead.\n3. the fool - only the bold will ride this wave to the top.\nverdict: make the move or make excuses—your call.
        `;

        const checkVerdictContext = composeContext({
            state,
            template: checkVerdictContextTemplate,
        });

        const checkVerdict = await generateWithRetry(
            runtime,
            checkVerdictContext,
            3,
            ["verdict", "tldr", "buy", "sell"]
        );

        try {
            const getLastPredictionQuery = `
            SELECT id, direction, bitcoinPrice 
            FROM "bitcoin-prediction" 
            WHERE rightness = 'NOT CHECKED' 
            ORDER BY createdAt DESC 
            LIMIT 1
        `;

            const lastPrediction = await runtime.databaseAdapter.db
                .prepare(getLastPredictionQuery)
                .get();

            if (!!lastPrediction && !!lastPrediction.direction) {
                const priceDifference =
                    bitcoinInfo.current_price - lastPrediction.bitcoinPrice;

                let rightness = "INCORRECT";

                if (
                    (lastPrediction.direction === "UP" &&
                        priceDifference > 0) ||
                    (lastPrediction.direction === "DOWN" && priceDifference < 0)
                ) {
                    rightness = "CORRECT";
                }

                const updateQuery = `
                UPDATE "bitcoin-prediction" 
                SET rightness = ? 
                WHERE id = ?
                `;

                const updateResult = await runtime.databaseAdapter.db
                    .prepare(updateQuery)
                    .run(rightness, lastPrediction.id);
            }
        } catch (error) {
            elizaLogger.error(
                `Failed to check last prediction: ${error?.message}`
            );
        }

        if (checkVerdict) {
            try {
                const query = `
            INSERT INTO "bitcoin-prediction" (content, direction, bitcoinPrice, rightness)
            VALUES (?, ?, ?, ?)
    `;

                await runtime.databaseAdapter.db
                    .prepare(query)
                    .run(
                        checkVerdict?.toLowerCase(),
                        answer?.direction,
                        bitcoinInfo.current_price,
                        "NOT CHECKED"
                    );
            } catch (error) {
                elizaLogger.error(
                    `Error inserting bitcoin prediction: ${error?.message}`
                );
            }
        }
    } catch (error) {
        elizaLogger.error(
            `Error generating bitcoin prediction: ${error?.message}`
        );
    }
};
