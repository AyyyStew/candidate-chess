import { Hono } from "hono";
import { ping } from "./routes/ping";
import { counter } from "./routes/counter";

const app = new Hono();

app.route("/api", ping);
app.route("/api", counter);

export default app;
