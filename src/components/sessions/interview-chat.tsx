"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, SquarePen } from "lucide-react";
import { toast } from "sonner";

import { completeSession } from "@/lib/sessions/actions";
import {
  MAX_MESSAGE_LENGTH,
  type ChatMessage,
} from "@/lib/sessions/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  sessionId: string;
  initialMessages: ChatMessage[];
};

export function InterviewChat({ sessionId, initialMessages }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [ending, startEnding] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  // Streams one interviewer turn. An empty `message` opens the interview.
  const send = useCallback(
    async (message: string) => {
      setStreaming(true);
      setStreamed("");
      try {
        const res = await fetch(`/api/sessions/${sessionId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? "The interviewer didn't respond.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setStreamed(acc);
          scrollToBottom();
        }

        const reply = acc.trim();
        if (reply) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: reply },
          ]);
        }
        setStreamed("");
      } catch (err) {
        // Roll back the optimistic candidate turn so they can retry cleanly.
        if (message) {
          setMessages((prev) => {
            const copy = [...prev];
            if (copy.at(-1)?.role === "user") copy.pop();
            return copy;
          });
          setDraft(message);
        }
        setStreamed("");
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setStreaming(false);
        scrollToBottom();
      }
    },
    [sessionId, scrollToBottom]
  );

  // Open the interview on first mount when no transcript exists yet. Deferred
  // off the effect's synchronous path so the kickoff's setState doesn't cascade
  // a render — it's the start of an async fetch, not derived state.
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    if (initialMessages.length === 0) {
      queueMicrotask(() => void send(""));
    }
  }, [initialMessages.length, send]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function submit() {
    const text = draft.trim();
    if (!text || streaming) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    void send(text);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function endInterview() {
    startEnding(async () => {
      const result = await completeSession(
        { error: null },
        toFormData({ id: sessionId })
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  const answered = messages.some((m) => m.role === "user");

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-100 flex-col gap-4">
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border bg-card/40 p-4 sm:p-6"
      >
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.content} />
        ))}
        {streaming && streamed ? (
          <Bubble role="assistant" text={streamed} />
        ) : null}
        {streaming && !streamed ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {answered ? "The interviewer is thinking…" : "Starting your interview…"}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={
              streaming ? "Wait for the interviewer…" : "Type your answer… (Enter to send, Shift+Enter for a new line)"
            }
            disabled={streaming || ending}
            className="min-h-12 flex-1 resize-none"
            rows={2}
            aria-label="Your answer"
          />
          <Button
            type="button"
            onClick={submit}
            disabled={streaming || ending || !draft.trim()}
            aria-label="Send answer"
          >
            <Send />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {answered
              ? "Done practicing? End the interview to get scored feedback."
              : "Answer a few questions, then end the interview for feedback."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={endInterview}
            disabled={ending || streaming}
          >
            {ending ? (
              <>
                <Loader2 className="animate-spin" /> Scoring…
              </>
            ) : (
              <>
                <SquarePen /> End &amp; get feedback
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground"
            : "max-w-[85%] rounded-2xl rounded-bl-sm border bg-background px-4 py-2.5 text-sm whitespace-pre-wrap"
        }
      >
        {text}
      </div>
    </div>
  );
}

function toFormData(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}
