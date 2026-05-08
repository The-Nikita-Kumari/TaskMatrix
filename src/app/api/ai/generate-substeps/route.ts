import { NextRequest, NextResponse } from "next/server";

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

    const prompt = `You are a project management assistant. Given a task title and optional description, generate 4-6 clear, actionable sub-steps to complete this task.

Task Title: "${title}"
${description ? `Task Description: "${description}"` : ""}

You must respond ONLY with a valid JSON object matching this exact structure, with no markdown, no backticks, no preamble:
{"substeps": ["Step 1 description", "Step 2 description", "Step 3 description", "Step 4 description"]}

Each step should be concise (under 12 words), actionable, and in logical order.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      console.error("Gemini API error:", err);
      return NextResponse.json(
        { error: err?.error?.message || "AI request failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({ substeps: parsed.substeps ?? [] });
  } catch (err) {
    console.error("generate-substeps error:", err);
    return NextResponse.json({ error: "Failed to generate sub-steps" }, { status: 500 });
  }
}
