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
import { insertTarotLog } from "../utils";

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
                insertTarotLog(
                    runtime.databaseAdapter.db,
                    `Exact words not found in the prediction: ${exactWordsToCheck.join(
                        ", "
                    )}\n\nPrediction: ${prediction}`
                );
                throw new Error("Exact words not found in the prediction");
            }

            if (!prediction) {
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

const getPostsFromLastHours = async (runtime: IAgentRuntime, hours: number) => {
    try {
        const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

        const posts = await runtime.databaseAdapter.db
            .prepare(
                `SELECT id, createdAt, content FROM memories 
             WHERE userId IN (SELECT id FROM accounts WHERE name = 'tarotmancer') 
             AND createdAt >= ?
             ORDER BY createdAt DESC`
            )
            .all(hoursAgo.getTime());

        const postsText = posts.map(({ content }) => {
            try {
                const parsedContent = JSON.parse(content);

                if (parsedContent.inReplyTo) {
                    return "";
                }

                return `[${new Date(
                    parsedContent.createdAt
                ).toLocaleString()}]: ${parsedContent.text}`;
            } catch {
                return "";
            }
        });

        return postsText.filter(Boolean).join("\n");
    } catch {
        elizaLogger.error(`Error getting posts from last ${hours} hours`);
        return "";
    }
};

export const getTarotPrediction = async (
    runtime: IAgentRuntime,
    state: State
) => {
    insertTarotLog(runtime.databaseAdapter.db, "SPREAD_TAROT action called");

    const cards = generateRandomCards();

    const tokensChoice = await runtime.cacheManager.get("tokens-choice");

    const isForAllTokens =
        tokensChoice === "tokens-with-large-market-cap-change";

    insertTarotLog(runtime.databaseAdapter.db, `tokensChoice: ${tokensChoice}`);

    const cardsDescription = cards
        .map((card) => {
            if (card.type === "major-arcana") {
                return `${card.value} (Major Arcana)`;
            }
            return `${card.value} of ${card.subtype} (Minor Arcana)`;
        })
        .join("\n");

    insertTarotLog(
        runtime.databaseAdapter.db,
        `cardsDescription: ${cardsDescription}`
    );

    const hours = process.env.MIN_TOKEN_REPEAT_HOURS
        ? parseInt(process.env.MIN_TOKEN_REPEAT_HOURS)
        : 6;

    const posts = await getPostsFromLastHours(runtime, hours);

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

        Your posts in the last ${hours} hours:
        ${posts}

        Task:
        1) check the data received from Tokens data.
        2) ${choice}.
        3) spread 3 card tarot based on the provided tarot cards for today for the token of your choice and write a tweet taking into account the character, tone of voice, lore, post examples of tarotmancer.
        Notes: ACT AND RESPONSE LIKE TAROTMANCER, DO NOT ACT AND RESPONSE LIKE BOT OR AGENT. DO NOT SHOW MIDTERM RESULTS - SEND ONLY FINAL TWEET. SEND NOTHING BUT THE FINAL RESULT OF STEP 3. TOTAL LENGHT MUST BE UNDER 200 CHARACTERS.

        The drawn cards are:
        ${cardsDescription}

        Rules for the prediction:
        1. Link the meanings of the provided cards to the data received for the token of choice and knowledge.
        2. Use lowercased token's ticker (e.g., $btc) in your tweet.
        3. Avoid using numbers; use descriptive and metaphorical language instead.
        4. Your prediction should have a straightforward advice (buy or sell the token).
        5. Your prediction can lean towards buying strong tokens during potential lows, but only when the context and evidence strongly support it.
        6. MUST BE LESS THAN 200 CHARACTERS. No hashtags and emojis. The tweet should be lowercased.
        7. DO NOT USE A TOKEN THAT WAS IN YOUR POSTS IN THE LAST ${hours} HOURS. IF ALL TOKENS HAVE BEEN USED, CHOOSE THE ONE THAT HAS NOT BEEN USED FOR THE LONGEST TIME.

        Examples of valid responses:

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

    const tickerRegex = /\$([a-zA-Z]+)/;
    const tickerMatch = response.prediction?.match(tickerRegex);
    const ticker = tickerMatch ? tickerMatch[1] : null;

    if (ticker) {
        insertTarotLog(runtime.databaseAdapter.db, `Choosed token: ${ticker}`);
    }

    const verdictRegex = /(verdict:|tldr:)[^.]*(buy|sell)[^.]*\./i;
    const verdictMatch = response.prediction?.match(verdictRegex);
    const verdict = verdictMatch ? verdictMatch[0].trim() : null;

    if (verdict) {
        insertTarotLog(runtime.databaseAdapter.db, `Verdict: ${verdict}`);
    }

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
