import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Vectorize } from "endpoints/vectorize";

const app = new Hono();
const openapi = fromHono(app, {
  docs_url: "/",
});

openapi.post("/api/vectorize", Vectorize);

export default app;
