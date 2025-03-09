import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    composeContext,
    elizaLogger,
    generateText,
} from "@elizaos/core";
import { createCanvas, loadImage } from "canvas";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { insertTarotLog } from "../utils";
import {
    CARD_WIDTH,
    CARDS_GAP,
    CARDS_HEIGHT,
    CARDS_X,
    CARDS_Y,
} from "./constants";
import { generateRandomCards, generateWithRetry } from "./utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getTarotPrediction = async (
    runtime: IAgentRuntime,
    state: State,
    message?: Memory
) => {
    insertTarotLog(runtime.databaseAdapter.db, "SPREAD_TAROT action called");

    const cards = generateRandomCards();

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
        1) make sure you have the full picture of a user request - read both the tweet/thread/post that the comment you were tagged in belongs to and the comment where you've been tagged.
        2) respond to the user with a 3 card tarot spread and your corresponding card reading on behalf of tarotmancer; the reading must follow the rules below. 
        3) after sending the spread and the reading, don't send anything else (including text and actions, especially CONTINUE).
        Notes: DONT SEND INTERIM RESULTS, DO SEND ONLY THE SPREAD AND READING, DONT ADD ANY OTHER TEXT.

        The drawn cards are:
        ${cardsDescription}

        # User request:
        ${message?.content.text}

        Rules for the prediction:
        1. link the meanings of the cards provided with the content and context of the tweet and comment you're tagged in - try your best to make the reading as personalized as possible.
        2. total lenght of your reply must fit twitter limitations (strictly less than or equal to 280 characters).
        3. the reply must be lowercased and contain no hashtags and emojis.

        Examples of valid responses:

        Example 1:
        The drawn cards are:
        The fool (Major Arcana)
        The magician (Major Arcana)
        Ten of pentacles (Minor Arcana)

        Result:
        let the cards unveil the truth, dear pure soul.\nI. fool - only those with vision enter early.\nII. magician - tools r here, but only ogs will use them.\nIII. 10 of pentacles - generational wealth or regret - should I choose?\ntldr - seems cabalish, 100x only for the chosen ones.

        Example 2:
        The drawn cards are:
        The tower (major Arcana)
        The magician (major Arcana)
        The fool (major Arcana)

        Result:
        @user1 u meant cards? i have some:\nI. tower - illusions crumble, reality smacks hard.\nII. magician – power is there, but who wields it?\nIII. fool – some will take the leap, most will fall.\ntldr - cards said the play is worth aping in,  dont forget to share profits lil bro.

        Example 3:
        The drawn cards are:
        the high priestess (Major Arcana)
        seven of swords (minor Arcana)
        the wheel of fortune (Major Arcana)

        Result:
        ah, a question worthy of the cards.\nI. high priestess - hidden alpha, not for everyone.\nII. 7 of swords - deception lurks, don't be the mark.\nIII. wheel of fortune - shift coming, ride or regret.\ntldr - insiders know. if you're not in, enter cautiously or stay sidelined.

        Note: While the reply should generally follow the structure and rules outlined above, the specific content should be unique and aligned with tarotmancer's character, lore, style, and the tweet and comment's content and context. Creativity and variation in the response are encouraged, as long as the rules are adhered to.
    `;

    const context = composeContext({
        state,
        template: contextTemplate,
    });

    const prediction = await generateWithRetry(runtime, context);

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

    ctx.drawImage(firstCard, CARDS_X, CARDS_Y, CARD_WIDTH, CARDS_HEIGHT);
    ctx.drawImage(
        secondCard,
        CARDS_X + CARD_WIDTH + CARDS_GAP,
        CARDS_Y,
        CARD_WIDTH,
        CARDS_HEIGHT
    );
    ctx.drawImage(
        thirdCard,
        CARDS_X + CARD_WIDTH * 2 + CARDS_GAP * 2,
        CARDS_Y,
        CARD_WIDTH,
        CARDS_HEIGHT
    );

    const buffer = canvas.toBuffer("image/png");

    return {
        media: buffer,
        prediction,
    };
};

const generate: Action = {
    name: "SPREAD_TAROT",
    similes: [],
    examples: [],
    description: "Generate a tarot prediction based on the current market",
    suppressInitialMessage: true,
    validate: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state: State
    ) => {
        const { text } = _message.content;

        const contextTemplate = `
            # Task
            Determine if the user is specifically requesting a tarot reading or spread.

            # Rules for validation
            1. Return "true" only if:
               - The user explicitly asks for a tarot reading/spread
               - The user asks for fortune telling or divination
               - The user asks about their future or seeks guidance
            2. Return "false" if:
               - The message is empty
               - The request is unrelated to tarot/divination
               - The user is just making a statement or asking an unrelated question

            # Examples
            Valid requests (should return "true"):
            - "Can I get a tarot reading?"
            - "What do the cards say about my future?"
            - "Pull some cards for me"
            - "Need guidance from tarot"

            Invalid requests (should return "false"):
            - "Hello"
            - "What's the weather?"
            - "Nice cards"
            - "" (empty message)

            # User request:
            ${text}

            Return only "true" or "false" based on these rules.
        `;

        const context = composeContext({
            state: _state,
            template: contextTemplate,
        });

        const isShouldRespond = await generateText({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
        });

        if (isShouldRespond === "true") {
            return true;
        }

        elizaLogger.info(`Not responding to ${text}`);

        return false;
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
            _state,
            _message
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
