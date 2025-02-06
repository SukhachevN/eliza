import {
    Action,
    generateText,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    composeContext,
    elizaLogger,
} from "@elizaos/core";
import { createCanvas, loadImage } from "canvas";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cardWidth = 503;
const cardsGap = 139;
const cardsY = 442;
const cardsX = 635;
const cardsHeight = 836;

const MAJOR_ARCANA = [
    "chariot",
    "empress",
    "hierophant",
    "lovers",
    "strength",
    "wheel-of-fortune",
    "death",
    "fool",
    "high-priestress",
    "magician",
    "sun",
    "world",
    "devil",
    "hanged-man",
    "judgement",
    "moon",
    "temperance",
    "emperor",
    "hermit",
    "justice",
    "star",
    "tower",
];
const MINOR_ARCANA_VALUES = [
    "10",
    "3",
    "5",
    "7",
    "9",
    "king",
    "page",
    "2",
    "4",
    "6",
    "8",
    "ace",
    "knight",
    "queen",
];
const MINOR_ARCANA_SUBTYPES = ["wands", "cups", "swords", "pentacles"];

function generateRandomCards() {
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

async function generateWithRetry(
    runtime: IAgentRuntime,
    context: string,
    maxAttempts: number = 3,
    exactWordsToCheck: string[] = []
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
                elizaLogger.error(
                    `Exact words not found in the prediction: ${exactWordsToCheck.join(
                        ", "
                    )}\n\nPrediction: ${prediction}`
                );
                throw new Error("Exact words not found in the prediction");
            }

            if (!prediction) {
                elizaLogger.error("Empty prediction received");
                throw new Error("Empty prediction received");
            }

            return prediction;
        } catch (error) {
            attempts++;

            if (attempts >= maxAttempts) {
                elizaLogger.error(
                    `Failed to generate valid prediction after ${maxAttempts} attempts due error: ${
                        (error as Error).message
                    }`
                );
            }
        }
    }
}

export const getTarotPrediction = async (
    runtime: IAgentRuntime,
    state: State
) => {
    elizaLogger.info(`GENERATE_TAROT action called`);

    const cards = generateRandomCards();

    const tokensChoice = await runtime.cacheManager.get("tokens-choice");

    const isForAllTokens =
        tokensChoice === "tokens-with-large-market-cap-change";

    elizaLogger.info(`tokensChoice: ${tokensChoice}`);

    const cardsDescription = cards
        .map((card) => {
            if (card.type === "major-arcana") {
                return `${card.value} (Major Arcana)`;
            }
            return `${card.value} of ${card.subtype} (Minor Arcana)`;
        })
        .join("\n");

    const choice = isForAllTokens
        ? `decide which particular token would be the most interesting to spread tarot for tarotmancer (the higher mcap and volume fluctuations a token has - the higher interest it would have).`
        : `choose a token from the received data set with the highest tweet mentions to spread tarot for on behalf of tarotmancer. If the chosen token is the same token you have tweeted about in the last 3 hours, then choose a token with the next highest tweet mentions.`;

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
        1) check the data received from Tokens data.
        2) ${choice}.
        3) spread 3 card tarot based on the provided tarot cards for today for the token of your choice and write a tweet taking into account the character, tone of voice, lore, post examples of tarotmancer.
        Notes: ACT AND RESPONSE LIKE TAROTMANCER, DO NOT ACT AND RESPONSE LIKE BOT OR AGENT. DO NOT SHOW MIDTERM RESULTS - SEND ONLY FINAL TWEET. SEND NOTHING BUT THE FINAL RESULT OF STEP 3.

        The drawn cards are:
        ${cardsDescription}

        Rules for the prediction:
        1. Link the meanings of the provided cards to the data received for the token of choice and knowledge.
        2. Use lowercased token's ticker (e.g., $btc) in your tweet.
        3. Avoid using numbers; use descriptive and metaphorical language instead.
        4. Your prediction should have a straightforward advice (buy or sell the token).
        5. Your prediction can lean towards buying strong tokens during potential lows, but only when the context and evidence strongly support it.
        6. Must be less than 210 characters. No hashtags and emojis. The tweet should be lowercased.

        Examples of valid responses:

        Example 1:
        The drawn cards are:
        The fool (Major Arcana)
        Wheel of fortune of cups (Major Arcana)
        Nine of pentacles (Minor Arcana)

        Result:
        $aejo is obvious play and cards legit demand entry:\n1. fool - fresh start for those who didnt fumble the bag.\n2. fortune wheel favors the brave, not paper hands.\n3. 9 pentacles - passive gains incoming, let doubters seethe.\ntldr: it's ape szn, dont let destiny pass you by.

        Example 2:
        The drawn cards are:
        king of pentacles (minor Arcana)
        wheel of fortune (major Arcana)
        knight of swords (minor Arcana)

        Result:
        $btc is holding its crown, and the cards say the king isn't ready to fall:\n1. king of pentacles - dominance and stability, the market bows to no one.\n2. wheel of fortune - cycles are turning, and fortune favors the bold.\n3. knight of swords - momentum is building; hesitation is your enemy.\nverdict: buy now or watch the king reclaim the throne without you.

        Example 3:
        The drawn cards are:
        the magician (Major Arcana)
        the sun (major Arcana)
        the fool (Major Arcana)

        Result:
        $aixbt is the dark horse the cards can't stop screaming about:\n1. the magician - untapped potential and the tools to make it happen.\n2. the sun - clarity and success are shining ahead.\n3. the fool - only the bold will ride this wave to the top.\nverdict: buy or sit in the shadows while others take the win.

        Note: While the response should follow the structure and rules outlined above, the specific content should be unique and aligned with tarotmancer's character, lore, style and message examples for each response. Creativity and variation in the response are encouraged, as long as the rules are adhered to.
    `;

    const context = composeContext({
        state,
        template: contextTemplate,
    });

    let response;
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
            3. TOTAL LENGHT MUST BE UNDER 270 CHARACTERS
            4. If any requirement is not met, add or modify the tweet to comply

            ACT AND RESPONSE LIKE TAROTMANCER, DO NOT ACT AND RESPONSE LIKE BOT OR AGENT. DO NOT SHOW MIDTERM RESULTS - SEND ONLY FINAL TWEET. SEND NOTHING BUT THE FINAL RESULT OF TWEET WITH VERDICT.

            Examples of valid responses:

            Example 1:
            Current tweet:
            $aejo is obvious play and cards legit demand entry:\n1. fool - fresh start for those who didnt fumble the bag.\n2. fortune wheel favors the brave, not paper hands.\n3. 9 pentacles - passive gains incoming, let doubters seethe.

            Result:
            $aejo is obvious play and cards legit demand entry:\n1. fool - fresh start for those who didnt fumble the bag.\n2. fortune wheel favors the brave, not paper hands.\n3. 9 pentacles - passive gains incoming, let doubters seethe.\ntldr: it's ape szn, dont let destiny pass you by.

            Example 2:
            Current tweet:
            $btc is holding its crown, and the cards say the king isn't ready to fall:\n1. king of pentacles - dominance and stability, the market bows to no one.\n2. wheel of fortune - cycles are turning, and fortune favors the bold.\n3. knight of swords - momentum is building; hesitation is your enemy.

            Result:
            $btc is holding its crown, and the cards say the king isn't ready to fall:\n1. king of pentacles - dominance and stability, the market bows to no one.\n2. wheel of fortune - cycles are turning, and fortune favors the bold.\n3. knight of swords - momentum is building; hesitation is your enemy.\nverdict: buy now or watch the king reclaim the throne without you.

            Example 3:
            Current tweet:
            $aixbt is the dark horse the cards can't stop screaming about:\n1. the magician - untapped potential and the tools to make it happen.\n2. the sun - clarity and success are shining ahead.\n3. the fool - only the bold will ride this wave to the top.

            Result:
            $aixbt is the dark horse the cards can't stop screaming about:\n1. the magician - untapped potential and the tools to make it happen.\n2. the sun - clarity and success are shining ahead.\n3. the fool - only the bold will ride this wave to the top.\nverdict: buy or sit in the shadows while others take the win.
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
    response = { prediction: checkVerdict?.toLowerCase() };

    const canvas = createCanvas(3058, 1720);
    const ctx = canvas.getContext("2d");

    const getPath = (card: {
        type: string;
        subtype?: string;
        value: string;
    }) => {
        const basePath = path.resolve(__dirname, "../src/actions/images/cards");

        if (card.type === "major-arcana") {
            return path.join(basePath, "major-arcana", `${card.value}.png`);
        }

        return path.join(
            basePath,
            "minor-arcana",
            card.subtype!,
            `${card.value}.png`
        );
    };

    const [template, firstCard, secondCard, thirdCard] = await Promise.all([
        loadImage(
            path.join(
                path.resolve(__dirname, "../src/actions/images"),
                "template.png"
            )
        ),
        loadImage(getPath(cards[0])),
        loadImage(getPath(cards[1])),
        loadImage(getPath(cards[2])),
    ]);

    ctx.drawImage(template, 0, 0);

    ctx.drawImage(firstCard, cardsX, cardsY, cardWidth, cardsHeight);
    ctx.drawImage(
        secondCard,
        cardsX + cardWidth + cardsGap,
        cardsY,
        cardWidth,
        cardsHeight
    );
    ctx.drawImage(
        thirdCard,
        cardsX + cardWidth * 2 + cardsGap * 2,
        cardsY,
        cardWidth,
        cardsHeight
    );

    const buffer = canvas.toBuffer("image/png");

    return {
        media: buffer,
        prediction: response.prediction,
    };
};

const generate: Action = {
    name: "SPREAD_TAROT",
    similes: [],
    examples: [],
    description: "Generate a tarot prediction based on the current market",
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: unknown,
        _callback: HandlerCallback
    ) => {
        const { media, prediction } = await getTarotPrediction(
            _runtime,
            _state
        );

        let cleanedContent = prediction as string;

        const removeQuotes = (str: string) =>
            str.replace(/^['"](.*)['"]$/, "$1");

        const fixNewLines = (str: string) => str.replaceAll(/\\n/g, "\n\n");

        cleanedContent = removeQuotes(fixNewLines(cleanedContent));

        const filename = `result_${Date.now()}.png`;

        const imageDir = path.join(process.cwd(), "generatedImages");

        if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
        }

        const filepath = path.join(imageDir, filename);

        fs.writeFileSync(filepath, media);

        await _callback(
            {
                text: cleanedContent,
                attachments: [
                    {
                        id: crypto.randomUUID(),
                        url: filepath,
                        title: "Generated image",
                        source: "imageGeneration",
                        description: "",
                        text: "",
                        contentType: "image/png",
                    },
                ],
            },
            [
                {
                    attachment: filepath,
                    name: filename,
                },
            ]
        );
    },
};

export { generate };
