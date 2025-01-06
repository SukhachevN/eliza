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
import fs from "fs/promises";

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
        Here is the list of tokens that are suitable for the base scenarios:
        ${suitabletokens}

        Please generate a tarot card reading for the next 3 days based on the provided token data.

        The response should include:
        1. An array of tarot cards. Each card should have:
           - A type: either "major-arcana" or "minor-arcana".
           - If "minor-arcana", include a subtype: one of "wands", "cups", "swords", or "pentacles".
           - The card value, which can be one of the following:
             - For major-arcana: ["chariot", "empress", "hierophant", "lovers", "strength", "wheel-of-fortune", "death", "fool", "high-priestress", "magician", "sun", "world", "devil", "hanged-man", "judgement", "moon", "temperance", "emperor", "hermit", "justice", "star", "tower"].
             - For minor-arcana: ["10", "3", "5", "7", "9", "king", "page", "2", "4", "6", "8", "ace", "knight", "queen"].

        2. A maximum 140-character prediction for buying or selling specific tokens based on the tarot card reading and the provided token data.

        Example output format:
        {
          "cards": [
            { "type": "major-arcana", "value": "chariot" },
            { "type": "minor-arcana", "subtype": "wands", "value": "ace" },
            { "type": "minor-arcana", "subtype": "cups", "value": "king" }
          ],
          "prediction": "Buy token X and sell token Y. Market shows potential for growth in token X due to favorable trends."
        }

        Generate the response in this format. Return only json.
        `;

        const llmResponse = await generateText({
            runtime: _runtime,
            context: prompt,
            modelClass: ModelClass.SMALL,
        });

        const response = JSON.parse(llmResponse) as {
            cards: { type: string; subtype?: string; value: string }[];
            prediction: string;
        };

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

        const outputPath = path.join(
            path.resolve(__dirname, "../src/actions/images"),
            "result.png"
        );

        await fs.writeFile(outputPath, buffer);

        await _callback(
            {
                text: response.prediction,
                attachments: [
                    {
                        id: crypto.randomUUID(),
                        url: outputPath,
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
                    attachment: outputPath,
                    name: `result.png`,
                },
            ]
        );
    },
};

export { generate };
