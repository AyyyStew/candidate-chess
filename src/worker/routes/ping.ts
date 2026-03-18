import { Hono } from "hono";

export const ping = new Hono();

ping.get("/ping", (c) => {
  return c.json({ message: "pong", timestamp: Date.now() });
});

ping.get("/pong", (c) => {
  return c.json({ message: "ping", timestamp: Date.now() });
});
