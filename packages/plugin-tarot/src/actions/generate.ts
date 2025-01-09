import {
    Action,
    generateText,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    composeContext,
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

/**
 * Truncate text to fit within the Twitter character limit, ensuring it ends at a complete sentence.
 */
function truncateToCompleteSentence(
    text: string,
    maxTweetLength: number
): string {
    if (text.length <= maxTweetLength) {
        return text;
    }

    // Attempt to truncate at the last period within the limit
    const lastPeriodIndex = text.lastIndexOf(".", maxTweetLength - 1);
    if (lastPeriodIndex !== -1) {
        const truncatedAtPeriod = text.slice(0, lastPeriodIndex + 1).trim();
        if (truncatedAtPeriod.length > 0) {
            return truncatedAtPeriod;
        }
    }

    // If no period, truncate to the nearest whitespace within the limit
    const lastSpaceIndex = text.lastIndexOf(" ", maxTweetLength - 1);
    if (lastSpaceIndex !== -1) {
        const truncatedAtSpace = text.slice(0, lastSpaceIndex).trim();
        if (truncatedAtSpace.length > 0) {
            return truncatedAtSpace + "...";
        }
    }

    // Fallback: Hard truncate and add ellipsis
    const hardTruncated = text.slice(0, maxTweetLength - 3).trim();
    return hardTruncated + "...";
}

// Добавить функцию для генерации случайных карт
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

export const getTarotPrediction = async (
    runtime: IAgentRuntime,
    state: State
) => {
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

    Task: Generate a 3-day prediction based on the provided tarot cards and their meanings for top solana tokens, new solana tokens, Bitcoin and Ethereum. Write in the voice and style of {{agentName}} @{{twitterUserName}}.

    The drawn cards are:
    ${cardsDescription}

    Rules for the prediction:
    1. Link the meanings of the provided cards to the behavior or trends of the tokens
    2. Use token symbols (e.g., $BTC) in the prediction
    3. Avoid using numbers; use descriptive and metaphorical language instead
    4. Lean towards suggesting buying tokens during potential lows
    5. Must be less than {{maxTweetLength}} characters. No emojis

    Examples of valid responses:

    Example 1:

    The drawn cards are:
    justice (Major Arcana)
    queen of cups (Minor Arcana)
    tower (Major Arcana)

    Result:
    Justice advises $BTC holders to stay balanced. Queen of Cups suggests $ETH could bring emotional fulfillment. Tower warns $SOL may face sudden changes; buy at dips.

    Example 2:

    The drawn cards are:
    star (Major Arcana)
    knight of pentacles (Minor Arcana)
    death (Major Arcana)

    Result:
    The Star illuminates hope for $BTC. Knight of Pentacles signals $ETH moving steadily. Death suggests $SOL may undergo transformation; opportunities lie in the change.

    Example 3:

    The drawn cards are:
    chariot (Major Arcana)
    king of swords (Minor Arcana)
    temperance (Major Arcana)

    Result:
    The Chariot encourages bold moves for $BTC. King of Swords highlights strategic opportunities in $ETH. Temperance suggests $SOL requires patience and balance.

    Note: While the response should follow the structure and rules outlined above, the specific content, style, and card choices must be random and unique for each response. Creativity and variation in the response are encouraged, as long as therules are adhered to.
`;

    const context = composeContext({
        state,
        template: contextTemplate,
    });

    let response;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            const prediction = await generateText({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

            if (!prediction) {
                throw new Error("Empty prediction received");
            }

            response = { prediction };
            break;
        } catch (error) {
            attempts++;
            console.error(`Attempt ${attempts} failed:`, error);

            if (attempts >= maxAttempts) {
                throw new Error(
                    "Failed to generate valid tarot reading after multiple attempts"
                );
            }
        }
    }

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
    name: "GENERATE_TAROT",
    similes: ["TAROT_GENERATE", "TAROT_GEN", "TAROT_CREATE", "TAROT_MAKE"],
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

        const maxTweetLength = (_state.maxTweetLength as number) || 180;

        if (maxTweetLength) {
            cleanedContent = truncateToCompleteSentence(
                cleanedContent,
                maxTweetLength
            );
        }

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
                        description: "...",
                        text: "...",
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
