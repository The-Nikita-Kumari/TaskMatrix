import { NextRequest, NextResponse } from "next/server";

// Try models in order — use the same one that generate-substeps uses
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
];

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  for (const model of GEMINI_MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
        }),
      }
    );
    if (response.ok) {
      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }
  }
  throw new Error("All Gemini models failed");
}

function extractJSON(raw: string): Record<string, string> {
  // Strip markdown fences
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Find first {...} block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return JSON.parse(text);
}

export async function POST(req: NextRequest) {
  try {
    const { title, description } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI API key not configured. Add GEMINI_API_KEY to your .env.local file." },
        { status: 500 }
      );
    }

    const prompt = `You are a project management assistant. Based on the task title and description, suggest the appropriate priority level and provide a one-sentence reason.

Task Title: "${title}"
${description ? `Task Description: "${description}"` : ""}

Priority levels:
- critical: Urgent, blocking, production issues, security problems, imminent deadlines
- high: Important features, significant bugs, high business impact, near-term deadline
- medium: Normal features, minor bugs, regular improvements, moderate timeline
- low: Nice-to-have, documentation, minor enhancements, no pressing deadline

Respond ONLY with this JSON (no markdown, no explanation outside the JSON):
{"priority": "medium", "reason": "One sentence explaining why."}

priority must be exactly one of: critical, high, medium, low`;

    const rawText = await callGemini(apiKey, prompt);

    let priority = "medium";
    let reason = "";

    try {
      const parsed = extractJSON(rawText);
      const validPriorities = ["critical", "high", "medium", "low"];
      if (validPriorities.includes(parsed.priority)) {
        priority = parsed.priority;
        reason = parsed.reason ?? "";
      }
    } catch {
      // If JSON parse fails, try to find priority word directly in response
      const validPriorities = ["critical", "high", "medium", "low"];
      const lower = rawText.toLowerCase();
      for (const p of validPriorities) {
        if (lower.includes(`"${p}"`) || lower.includes(`priority": "${p}"`) || lower.includes(`priority is ${p}`)) {
          priority = p;
          break;
        }
      }
      reason = "AI suggestion applied.";
    }

    return NextResponse.json({ priority, reason });
  } catch (err) {
    console.error("suggest-priority error:", err);
    return NextResponse.json({ error: "Failed to suggest priority" }, { status: 500 });
  }
}
