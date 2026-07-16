import express from "express";
import { runLocalAgent } from "../../agent-core/local/agent.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Missing 'query' in request body" });
    }

    const result = await runLocalAgent(query);

    res.json({
      success: true,
      result
    });
  } catch (err) {
    console.error("Agent error:", err);
    res.status(500).json({ error: "Agent failed to process request" });
  }
});

export default router;
