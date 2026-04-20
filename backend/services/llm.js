const axios = require("axios");

const LLM_API_URL = process.env.LLM_API_URL || "http://127.0.0.1:11434/api/generate";
const LLM_MODEL = process.env.LLM_MODEL || "tinyllama"; // Changed to tinyllama for faster responses
const LLM_OPTIONS = {
  num_predict: 100, // Reduced further for ultra-fast responses
  temperature: 0.0  // Zero temperature for deterministic, fast responses
};

async function askLLM(prompt) {
  try {
    console.log(`🤖 Calling LLM with model: ${LLM_MODEL}`);

    const res = await axios.post(
      LLM_API_URL,
      {
        model: LLM_MODEL,
        prompt,
        stream: false,
        options: LLM_OPTIONS
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 45000 // 45 seconds - allows for slow Ollama responses
      }
    );

    const response = res.data.response || res.data.output || "";
    console.log(`✅ LLM Response received (${response.length} chars)`);
    return response;

  } catch (err) {
    console.log("❌ LLM ERROR:", err.message);
    console.log("❌ Error details:", err.code, err.response?.status);

    // Return a fallback response instead of failing completely
    return "LLM temporarily unavailable. Showing research data below.";
  }
}

module.exports = { askLLM };