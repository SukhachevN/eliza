import { DatabaseAdapter, elizaLogger } from "@elizaos/core";

export const insertTarotLog = async (
    db: DatabaseAdapter["db"],
    content: string
) => {
    try {
        const query = `
            INSERT INTO "plugin-tarot-logs" (content)
            VALUES (?)
    `;

        await db.prepare(query).run(content);
    } catch (error) {
        elizaLogger.error(`Error inserting tarot log: ${error?.message}`);
    }
};
