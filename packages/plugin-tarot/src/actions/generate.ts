import {
    Action,
    generateText,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
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

const generate: Action = {
    name: "GENERATE_TAROT",
    similes: ["TAROT_GENERATE", "TAROT_GEN", "TAROT_CREATE", "TAROT_MAKE"],
    examples: [],
    description: "Generate a tarot card based on a text prompt",
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
        const marketData = await Promise.all([
            _runtime.cacheManager.get("new-solana-tokens"),
            _runtime.cacheManager.get("top-tokens"),
        ]);

        const suitabletokens = marketData.join("\n");

        const prompt = `
        Explore the energy of the following tokens:
        ${suitabletokens}

        Draw three tarot cards and generate a 3-day prediction based on the cards' meanings and token energies. Ensure the cards are diverse, reflecting different aspects of the market and token behavior, with no repeated cards. The cards must be chosen randomly for each response to maintain unpredictability and uniqueness.

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
          "prediction": string (max 280 characters, summarizing insights tied to the cards and tokens, using token symbols, avoiding numbers, and leaning towards buying during lows)
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
        7. The prediction must not exceed 280 characters and should be written as a single line.
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

        while (attempts < maxAttempts) {
            try {
                const llmResponse = await generateText({
                    runtime: _runtime,
                    context: prompt,
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
            const basePath = path.resolve(
                __dirname,
                "../src/actions/images/cards"
            );

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

        const filename = `result_${Date.now()}.png`;

        const imageDir = path.join(process.cwd(), "generatedImages");

        if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
        }

        const filepath = path.join(imageDir, filename);

        fs.writeFileSync(filepath, buffer);

        await _callback(
            {
                text: response.prediction,
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
