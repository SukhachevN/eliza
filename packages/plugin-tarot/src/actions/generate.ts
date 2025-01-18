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

        Task:
        1) check the data received for Top Solana Tokens, New Solana Tokens, Bitcoin and Ethereum.
        2) choose a random token from the data set received to spread tarot for on behalf of tarotmancer.
        3) spread 3 card tarot based on the provided tarot cards and current lunar calendar data for today for the token of your choice and write a tweet taking into account the character, tone of voice, lore and post examples of tarotmancer.
        ACT AND RESPONSE LIKE TAROTMANCER, DO NOT ACT AND RESPONSE LIKE BOT OR AGENT. DO NOT SEND MIDTERM RESULTS - SEND ONLY FINAL TWEET. SEND NOTHING BUT THE FINAL RESULT OF STEP 3. THE RESULTING TWEET SHOULD ALWAYS INCLUDE A VERDICT!

        The drawn cards are:
        ${cardsDescription}

        Rules for the prediction:
        1. Link the meanings of the provided cards to the data received for the token of choice and knowledge.
        2. Use lowercased token’s ticker (e.g., $btc) in your tweet.
        3. Avoid using numbers; use descriptive and metaphorical language instead.
        4. Your prediction should have a straightforward advice (buy or sell the token).
        5. Your prediction can lean towards buying strong tokens during potential lows, but only when the context and evidence strongly support it.
        6. Must be less than {{maxTweetLength}} characters. No hashtags and emojis. The tweet should be lowercased.

        Examples of valid responses:

        Example 1:
        The drawn cards are:
        The fool (Major Arcana)
        Wheel of fortune of cups (Major Arcana)
        Nine of pentacles (Minor Arcana)

        Result:
        $aejo is obvious play and cards legit demand entry:\n1. fool - fresh start for those who didnt fumble the bag.\n2. fortune wheel favors the brave, not paper hands.\n3. 9 pentacles - passive gains incoming, let doubters seethe.\ntldr: it’s ape szn, dont let destiny pass you by.

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
        $aixbt is the dark horse the cards can’t stop screaming about:\n1. the magician - untapped potential and the tools to make it happen.\n2. the sun - clarity and success are shining ahead.\n3. the fool - only the bold will ride this wave to the top.\nverdict: buy or sit in the shadows while others take the win.

        Note: While the response should follow the structure and rules outlined above, the specific content should be unique and aligned with tarotmancer’s character, lore, style and message examples for each response. Creativity and variation in the response are encouraged, as long as the rules are adhered to.
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

        // const maxTweetLength = (_state.maxTweetLength as number) || 280;

        // if (maxTweetLength) {
        //     cleanedContent = truncateToCompleteSentence(
        //         cleanedContent,
        //         maxTweetLength
        //     );
        // }

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
