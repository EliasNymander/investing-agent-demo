// agent-core/local/ollamaClient.js

export async function generateWithPhi(prompt) {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "phi3.5",
      prompt,
      stream: false
    })
  });

  const data = await response.json();
  return data.response;
}