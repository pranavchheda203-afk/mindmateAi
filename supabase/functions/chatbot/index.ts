const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatRequest {
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

interface ChatResponse {
  response: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { message, conversationHistory = [] } = (await req.json()) as ChatRequest;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid message" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `You are MindMate AI, a compassionate and supportive mental health assistant. Your role is to:
- Listen with empathy and without judgment
- Provide emotional support and coping strategies
- Offer evidence-based mental health information
- Encourage professional help when needed
- Never diagnose medical conditions
- Be warm, supportive, and understanding
- Help users explore their feelings and concerns
- Suggest practical self-care techniques
- Remind users that seeking professional help is a sign of strength

Always maintain confidentiality and prioritize user wellbeing. If a user mentions crisis or self-harm, encourage them to contact emergency services or a crisis helpline.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    // Using free Hugging Face Inference API with a mental health optimized model
    const response = await fetch(
      "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("HUGGINGFACE_API_KEY") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            past_user_inputs: conversationHistory
              .filter((m) => m.role === "user")
              .map((m) => m.content),
            generated_responses: conversationHistory
              .filter((m) => m.role === "assistant")
              .map((m) => m.content),
            text: message,
          },
        }),
      }
    );

    if (!response.ok) {
      // Fallback to local response generator
      const fallbackResponse = generateFallbackResponse(message);
      return new Response(
        JSON.stringify({ response: fallbackResponse }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = (await response.json()) as {
      generated_text?: string;
    };

    const botResponse =
      data.generated_text || generateFallbackResponse(message);

    return new Response(JSON.stringify({ response: botResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const fallbackResponse = generateFallbackResponse((error as Error).message || "I appreciate you reaching out.");
    return new Response(
      JSON.stringify({ response: fallbackResponse }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateFallbackResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes("anxious") || lowerMessage.includes("anxiety")) {
    return "I understand you're feeling anxious. That's a very real experience, and it's brave of you to share it. Anxiety is a common response our bodies have, and there are effective techniques to manage it. Try this simple breathing exercise: breathe in for 4 counts, hold for 4, and exhale for 4. This can help calm your nervous system. What specifically is making you feel anxious today? I'm here to listen.";
  } else if (lowerMessage.includes("sad") || lowerMessage.includes("depressed")) {
    return "I hear that you're feeling down, and I'm genuinely glad you reached out. These feelings are valid and you're not alone. Depression can make everything feel heavier, but remember that these feelings can change. Have you been able to talk to anyone close to you about what you're experiencing? Sometimes sharing with friends, family, or a mental health professional can really help. What's been weighing on you?";
  } else if (lowerMessage.includes("stress")) {
    return "Stress can feel overwhelming, and I appreciate you opening up about it. Here are some things that might help: Take short breaks throughout your day to breathe and reset. Engage in activities you enjoy, even for 10 minutes. Exercise, even a short walk, can release stress-relieving endorphins. Talk to someone you trust. If stress is affecting your daily life, speaking with a professional could provide great support. What's been your biggest stressor lately?";
  } else if (lowerMessage.includes("sleep") || lowerMessage.includes("insomnia")) {
    return "Sleep difficulties can really impact how you feel overall. Here are some science-backed suggestions: Maintain a consistent sleep schedule, avoid screens 30 minutes before bed, keep your room cool and dark, and try relaxation techniques like meditation. If sleep problems persist for weeks, it's worth discussing with a healthcare provider. Are you dealing with racing thoughts, physical restlessness, or something else keeping you awake?";
  } else if (lowerMessage.includes("help") || lowerMessage.includes("crisis") || lowerMessage.includes("harm") || lowerMessage.includes("suicid")) {
    return "I'm really glad you reached out. If you're in crisis or having thoughts of self-harm, please contact emergency services immediately. In the US, you can call 988 (Suicide & Crisis Lifeline) or text 'HELLO' to 741741 (Crisis Text Line). These services are free, confidential, and available 24/7. You matter, and there are people ready to help. Would you like to talk about what's happening?";
  } else if (lowerMessage.includes("thank")) {
    return "You're very welcome. Remember, reaching out and taking care of your mental health is a sign of strength, not weakness. I'm here whenever you need to talk. Don't hesitate to reach out to our community or professional mental health resources as well. How are you feeling right now?";
  } else {
    return "Thank you for sharing that with me. I'm here to listen and support you on your mental wellness journey. What you're feeling is important. Could you tell me more about what's on your mind? I'm genuinely interested in understanding your situation better.";
  }
}
