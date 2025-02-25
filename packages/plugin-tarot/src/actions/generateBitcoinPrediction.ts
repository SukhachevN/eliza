import {
    IAgentRuntime,
    State,
    composeContext,
    elizaLogger,
} from "@elizaos/core";
import { generateRandomCards, generateWithRetry } from "./utils";

export const generateBitcoinPrediction = async (
    runtime: IAgentRuntime,
    state: State
) => {
    try {
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

        {{characterPostExamples}}

        {{postDirections}}

        Task:
        Spread 3 card tarot based on the provided tarot cards for today for the Bitcoin and write a tweet taking into account the character, tone of voice, lore, post examples of tarotmancer.
        Notes: ACT AND RESPONSE LIKE TAROTMANCER, DO NOT ACT AND RESPONSE LIKE BOT OR AGENT. DO NOT SHOW MIDTERM RESULTS - SEND ONLY FINAL TWEET. SEND NOTHING BUT THE FINAL RESULT OF TASK. TOTAL LENGHT MUST BE UNDER 200 CHARACTERS.

        The drawn cards are:
        ${cardsDescription}

        Rules for the prediction:
        1. Link the meanings of the provided cards to the data received for the token of choice and knowledge.
        2. Use lowercased token's ticker (e.g., $btc) in your tweet.
        3. Avoid using numbers; use descriptive and metaphorical language instead.
        4. Your prediction should have a straightforward advice (buy or sell the token).
        5. Your prediction can lean towards buying strong tokens during potential lows, but only when the context and evidence strongly support it.
        6. MUST BE LESS THAN 200 CHARACTERS. No hashtags and emojis. The tweet should be lowercased.

        Examples of valid predictions:

        Example 1:
        The drawn cards are:
        The fool (Major Arcana)
        The magician (Major Arcana)
        Ten of pentacles (Minor Arcana)

        Result:
        the cards don’t lie, and $aejo is calling:\n1. the fool - only those with vision enter early.\n2. the magician - the tools are here, but only real degens will use them.\n3. ten of pentacles - generational wealth or generational regret, your move.\nverdict: ape now or cope forever, there’s no second chance on fate.

        Example 2:
        The drawn cards are:
        king of pentacles (minor Arcana)
        wheel of fortune (major Arcana)
        knight of swords (minor Arcana)

        Result:
        $btc is holding its crown, and the cards say the king isn’t ready to fall:\n1. king of pentacles - dominance and stability, the market bows to no one.\n2. wheel of fortune - cycles are turning, and fortune favors the bold.\n3. knight of swords - momentum is building; hesitation is your enemy.\nverdict: buy now or watch the king reclaim the throne without you.

        Example 3:
        The drawn cards are:
        the magician (Major Arcana)
        the sun (major Arcana)
        the fool (Major Arcana)

        Result:
        $aixbt is the underdog story in real time, and the deck is bullish:\n1. the magician - untapped potential and the tools to make it happen.\n2. the sun - clarity and success are shining ahead.\n3. the fool - only the bold will ride this wave to the top.\nverdict: make the move or make excuses—your call.

        Note: While the response should generally follow the structure and rules outlined above, the specific content should be unique and aligned with tarotmancer’s character, lore, style and message examples for each response. Creativity and variation in the response are encouraged, as long as the rules are adhered to.
    `;

        const context = composeContext({
            state,
            template: contextTemplate,
        });

        const prediction = await generateWithRetry(runtime, context);

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

        if (checkVerdict) {
            try {
                const query = `
            INSERT INTO "bitcoin-predictions" (content)
            VALUES (?)
    `;

                await runtime.databaseAdapter.db
                    .prepare(query)
                    .run(checkVerdict?.toLowerCase());
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
