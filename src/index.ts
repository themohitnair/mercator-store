import { fromHono } from "chanfana";
import { Hono } from "hono";

const app = new Hono();

const openapi = fromHono(app, {
  docs_url: "/",
});

export default app;
