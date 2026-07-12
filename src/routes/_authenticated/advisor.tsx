import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/advisor")({
  head: () => ({ meta: [{ title: "AI Career Advisor — ResumeAI" }, { name: "robots", content: "noindex" }] }),
  component: AdvisorPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What roles should I target based on my skills?",
  "Give me a 90-day roadmap to become a data engineer.",
  "How do I prepare for a Google system design interview?",
  "What salary should I expect as a mid-level frontend dev in India?",
];

function AdvisorPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    // placeholder assistant message we'll stream into
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sess.session?.access_token
            ? { Authorization: `Bearer ${sess.session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "AI request failed");
        throw new Error(t);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload) as { text?: string };
            if (j.text) {
              acc += j.text;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chat failed");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh)] max-h-screen">
      <div className="border-b border-border p-6">
        <div className="text-xs uppercase tracking-widest text-primary font-semibold">Advisor</div>
        <h1 className="mt-1 text-2xl font-display font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> AI Career Advisor
        </h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-primary-gradient text-primary-foreground shadow-glow">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold">How can I help your career?</h2>
              <p className="mt-2 text-sm text-muted-foreground">Ask about roles, roadmaps, interviews, or salary insights.</p>
              <div className="mt-6 grid gap-2 max-w-lg mx-auto">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left rounded-lg border border-border p-3 text-sm hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={"flex gap-3 " + (m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-gradient text-primary-foreground shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <Card
                className={
                  "px-4 py-3 max-w-2xl whitespace-pre-wrap text-sm " +
                  (m.role === "user"
                    ? "bg-primary-gradient text-primary-foreground border-0"
                    : "")
                }
              >
                {m.content || (loading && i === messages.length - 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : "")}
              </Card>
              {m.role === "user" && (
                <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground shrink-0">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your career..."
            rows={1}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button onClick={() => send()} disabled={!input.trim() || loading} className="bg-primary-gradient">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
