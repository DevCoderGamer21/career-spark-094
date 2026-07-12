// Server-only Lovable AI Gateway helper. Uses raw fetch (no AI SDK dependency).
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type GwMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
        | { type: "file"; file: { filename: string; file_data: string } }
      >;
};

export interface GwOptions {
  model?: string;
  messages: GwMessage[];
  response_format?: { type: "json_object" } | { type: "json_schema"; json_schema: unknown };
  temperature?: number;
  stream?: boolean;
}

export function getApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing on server.");
  return key;
}

export async function callGateway(opts: GwOptions): Promise<Response> {
  const body = {
    model: opts.model ?? "google/gemini-3-flash-preview",
    messages: opts.messages,
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.stream ? { stream: true } : {}),
  };
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": getApiKey(),
    },
    body: JSON.stringify(body),
  });
  return res;
}

export async function callGatewayJSON<T = unknown>(opts: GwOptions): Promise<T> {
  const res = await callGateway({ ...opts, stream: false });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Rate limit reached — please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
    throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  // Attempt JSON parse; fall back to stripping code fences.
  try {
    return JSON.parse(content) as T;
  } catch {
    const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    return JSON.parse(stripped) as T;
  }
}
