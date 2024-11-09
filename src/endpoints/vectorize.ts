import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { Context } from "hono";
import { DbChunk } from "types";

export class Vectorize extends OpenAPIRoute {
  schema = {
    tags: ["Vectorize"],
    summary: "Vectorize chunks of text and store them in the database",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              chunks: z.array(z.string()),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
            }),
          },
        },
      },
      "400": {
        description: "Bad request",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
              details: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const {
      body: { chunks },
    } = await this.getValidatedData<typeof this.schema>();

    if (!chunks || chunks.length === 0) {
      return c.json({ error: "No chunks provided" }, 400);
    }

    try {
      await insertVectors(c, chunks);

      return c.json({
        success: true,
      });
    } catch (error) {
      console.error("Error inserting vectors:", error);
      return c.json(
        {
          error: "Failed to insert vectors",
          details: error.message,
        },
        500,
      );
    }
  }
}

async function insertVectors(c: Context<{ Bindings: Env }>, chunks: string[]) {
  //INFO: Change this if needed
  const chunkSize = 10;

  for (let i = 0; i < chunks.length; i += chunkSize) {
    const chunkBatch = chunks.slice(i, i + chunkSize);

    // Generate embeddings for the current batch
    const embeddingResult = await c.env.AI.run("@cf/baai/bge-large-en-v1.5", {
      text: chunkBatch,
    });
    const embeddingBatch: number[][] = embeddingResult.data;

    // Insert chunks into d1
    const insertChunkQuery =
      "INSERT INTO chunks (data) VALUES (?) RETURNING id";

    const chunkIds = await Promise.all(
      chunkBatch.map(async (chunk) => {
        const chunkInsertResult = await c.env.DB.prepare(insertChunkQuery)
          .bind(chunk)
          .run<DbChunk>();

        if (!chunkInsertResult.results?.[0]?.id) {
          throw new Error("Failed to insert chunk");
        }

        return chunkInsertResult.results[0].id;
      }),
    );

    // Insert vectors into vectorize
    await Promise.all(
      embeddingBatch.map(async (embedding, index) => {
        await c.env.VECTORIZE.upsert([
          {
            id: chunkIds[index].toString(),
            values: Array.from(embedding),
          },
        ]);
      }),
    );
  }
}
