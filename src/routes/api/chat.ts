import { createFileRoute } from "@tanstack/react-router";

// Streaming AI Career Advisor chat. Pipes SSE from Lovable AI Gateway.
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json().catch(() => null)) as {
          messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
        } | null;
        if (!body?.messages || !Array.isArray(body.messages)) {
          return new Response("Messages required", { status: 400 });
        }

        const systemPrompt = `You are ResumeAI, an expert career advisor. You help with resume improvement, ATS optimization, career roadmaps, interview preparation, salary insights, and skill-building recommendations. Be concise, warm, and specific. Use markdown for structure. When asked about roles, give concrete next steps with named certifications, courses, or projects.`;

        const gwRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [{ role: "system", content: systemPrompt }, ...body.messages],
          }),
        });

        if (!gwRes.ok) {
          const t = await gwRes.text().catch(() => "");
          const msg =
            gwRes.status === 429
              ? "Rate limit reached. Please retry in a moment."
              : gwRes.status === 402
              ? "AI credits exhausted. Please add credits."
              : `AI error ${gwRes.status}: ${t.slice(0, 200)}`;
          return new Response(msg, { status: gwRes.status });
        }

        // Transform OpenAI-style SSE into a simple text/event-stream of delta text chunks.
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const stream = new ReadableStream({
          async start(controller) {
            const reader = gwRes.body!.getReader();
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const payload = trimmed.slice(5).trim();
                  if (payload === "[DONE]") {
                    controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
                    controller.close();
                    return;
                  }
                  try {
                    const j = JSON.parse(payload) as {
                      choices?: Array<{ delta?: { content?: string } }>;
                    };
                    const text = j.choices?.[0]?.delta?.content;
                    if (text) {
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
                      );
                    }
                  } catch {
                    // skip
                  }
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
