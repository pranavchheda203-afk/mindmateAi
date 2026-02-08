// =====================================================
// Supabase Edge Function — MindMate Multi-LLM (India Safe)
// File: supabase/functions/chatbot/index.ts
// =====================================================

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

/* ---------------- CORS ---------------- */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/* ---------------- TYPES ---------------- */

interface ChatRequest {
  message: string;
  conversationHistory?: { role: string; content: string }[];
  model?: "auto" | "gemini" | "claude" | "groq";
}

/* ---------------- SYSTEM PROMPT ---------------- */

const SYSTEM_PROMPT = `
You are MindMate AI, a compassionate and evidence-based mental health assistant for users in India.

Rules:
- Be empathetic, calm, and non-judgmental
- Provide coping strategies, NOT medical diagnosis
- Encourage talking to trusted family, friends, or professionals
- Suggest Indian mental-health resources when crisis appears
- If self-harm or suicide risk is mentioned, strongly encourage:
  • Call AASRA: +91-9820466726 (24/7)
  • Visit nearest hospital or emergency services
- Prioritize emotional safety and cultural sensitivity
`;

/* ---------------- KEY HELPER ---------------- */

function requireKey(name: string): string {
  const key = Deno.env.get(name);
  if (!key) throw new Error(`${name} is not set in Supabase secrets`);
  return key;
}

/* ---------------- LLM CALLS ---------------- */

async function callGroq(messages: any[]) {
  const key = requireKey("GROQ_API_KEY");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    console.error("Groq error:", await res.text());
    throw new Error("Groq API error");
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? null;
}

async function callClaude(message: string) {
  const key = requireKey("ANTHROPIC_API_KEY");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok) {
    console.error("Claude error:", await res.text());
    throw new Error("Claude API error");
  }

  const json = await res.json();
  return json?.content?.[0]?.text ?? null;
}

async function callGemini(prompt: string) {
  const key = requireKey("GEMINI_API_KEY");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) {
    console.error("Gemini HTTP error:", await res.text());
    throw new Error("Gemini API error");
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("Gemini empty response");

  return text;
}

/* ---------------- AUTO-JUDGE ---------------- */

async function chooseBest(question: string, responses: string[]) {
  if (responses.length === 1) return responses[0];

  try {
    const judgePrompt = `
You are a mental-health expert evaluator.

User question:
"${question}"

Responses:
${responses.map((r, i) => `${i + 1}. ${r}`).join("\n\n")}

Return ONLY the number (1-${responses.length}) of the BEST response.
`;

    const result = await callGemini(judgePrompt);

    const match = result?.match(/\d+/);
    const index = match ? Number(match[0]) : 1;

    return responses[index - 1] ?? responses[0];
  } catch (err) {
    console.error("Judge failed → using first response:", err);
    return responses[0];
  }
}

/* ---------------- FALLBACK ---------------- */

function fallback(): string {
  return "I'm really glad you reached out. I'm here to listen. Can you share a little more about what you're going through?";
}

/* ---------------- MAIN HANDLER ---------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [], model = "auto" } =
      (await req.json()) as ChatRequest;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ response: "Invalid message provided." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const baseMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    let response: string | null = null;

    /* ---------- MODEL ROUTING ---------- */

    if (model === "groq") {
      response = await callGroq(baseMessages);
    } else if (model === "claude") {
      response = await callClaude(message);
    } else if (model === "gemini") {
      response = await callGemini(message);
    } else {
      // AUTO → compare all safely
      const [groq, claude, gemini] = await Promise.all([
        callGroq(baseMessages).catch(() => null),
        callClaude(message).catch(() => null),
        callGemini(message).catch(() => null),
      ]);

      const valid = [groq, claude, gemini].filter(Boolean) as string[];

      response =
        valid.length === 0 ? fallback() : await chooseBest(message, valid);
    }

    return new Response(JSON.stringify({ response: response ?? fallback() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function fatal error:", err);

    // Never expose internal error to mental-health users
    return new Response(JSON.stringify({ response: fallback() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
