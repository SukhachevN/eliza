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

export const getTarotPrediction = async (
    runtime: IAgentRuntime,
    state: State
) => {
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

    Task: Explore the energy of the top solana tokens, new solana tokens, Bitcoin and Ethereum. Generate a post in the voice and style and perspective of {{agentName}} @{{twitterUserName}}. Draw three tarot cards and generate a 3-day prediction based on the cards' meanings and token energies. Ensure the cards are diverse, reflecting different aspects of the market and token behavior, with no repeated cards. The cards must be chosen randomly for each response to maintain unpredictability and uniqueness.

    IMPORTANT: The response must be a valid JSON, strictly following the format below. No additional text, comments, or formatting is allowed. The response should align with the structure and rules provided but does not need to mimic the style or content of the examples.

    JSON structure:
    {
      "cards": [
        {
          "type": "major-arcana" | "minor-arcana",
          "subtype": "wands" | "cups" | "swords" | "pentacles" (required only for minor-arcana),
          "value": string (see allowed values below)
        }
      ],
      "prediction": string (max {{maxTweetLength}} characters, summarizing insights tied to the cards and tokens, using token symbols, avoiding numbers, and leaning towards buying during lows)
    }

    Allowed card values:
    - major-arcana: ["chariot", "empress", "hierophant", "lovers", "strength", "wheel-of-fortune", "death", "fool", "high-priestress", "magician", "sun", "world", "devil", "hanged-man", "judgement", "moon", "temperance", "emperor", "hermit", "justice", "star", "tower"]
    - minor-arcana: ["10", "3", "5", "7", "9", "king", "page", "2", "4", "6", "8", "ace", "knight", "queen"]

    Rules:
    1. Always return exactly 3 unique cards, chosen randomly for each response.
    2. Ensure the cards represent a variety of themes, avoiding overuse of specific cards (e.g., "wheel-of-fortune").
    3. Prediction must link the meanings of the drawn cards to the behavior or trends of the tokens.
    4. Use token symbols (e.g., $BTC) in the prediction.
    5. Avoid using numbers in the prediction; use descriptive and metaphorical language instead.
    6. Lean towards suggesting buying tokens during potential lows as part of the interpretation.
    7. The prediction must MUST be less than {{maxTweetLength}}. No emojis. Use \\n\\n (double spaces) between statements if there are multiple statements in your response.
    8. Response must be in pure JSON format.

    Examples of valid responses:

    Example 1:
    {
      "cards": [
        {"type":"major-arcana","value":"justice"},
        {"type":"minor-arcana","subtype":"cups","value":"queen"},
        {"type":"major-arcana","value":"tower"}
      ],
      "prediction": "Justice advises $BTC holders to stay balanced. Queen of Cups suggests $ETH could bring emotional fulfillment. Tower warns $SOL may face sudden changes; buy at dips."
    }

    Example 2:
    {
      "cards": [
        {"type":"major-arcana","value":"star"},
        {"type":"minor-arcana","subtype":"pentacles","value":"knight"},
        {"type":"major-arcana","value":"death"}
      ],
      "prediction": "The Star illuminates hope for $BTC. Knight of Pentacles signals $ETH moving steadily. Death suggests $SOL may undergo transformation; opportunities lie in the change."
    }

    Example 3:
    {
      "cards": [
        {"type":"major-arcana","value":"chariot"},
        {"type":"minor-arcana","subtype":"swords","value":"king"},
        {"type":"major-arcana","value":"temperance"}
      ],
      "prediction": "The Chariot encourages bold moves for $BTC. King of Swords highlights strategic opportunities in $ETH. Temperance suggests $SOL requires patience and balance."
    }

    Note: While the response should follow the structure and rules outlined above, the specific content, style, and card choices must be random and unique for each response. Creativity and variation in the response are encouraged, as long as the JSON structure and rules are adhered to.
    `;

    let response;
    let attempts = 0;
    const maxAttempts = 3;

    const context = composeContext({
        state,
        template: contextTemplate,
    });

    while (attempts < maxAttempts) {
        try {
            const llmResponse = await generateText({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

            const cleanedResponse = llmResponse
                .trim()
                .replace(/^```json\s*/, "")
                .replace(/\s*```$/, "")
                .replace(/[\u200B-\u200D\uFEFF]/g, "");

            response = JSON.parse(cleanedResponse) as {
                cards: { type: string; subtype?: string; value: string }[];
                prediction: string;
            };

            if (
                !response.cards ||
                !Array.isArray(response.cards) ||
                !response.prediction
            ) {
                throw new Error("Invalid response structure");
            }

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
        loadImage(getPath(response.cards[0])),
        loadImage(getPath(response.cards[1])),
        loadImage(getPath(response.cards[2])),
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
