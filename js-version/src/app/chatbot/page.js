// app/chat/page.js
"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Response } from "@/components/ai-elements/response";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  Send,
  StopCircle,
  Bot,
  User,
  Clock,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";

const BOT_AVATAR = "https://api.dicebear.com/7.x/bottts/svg?seed=Gemini";
const USER_AVATAR = "https://api.dicebear.com/7.x/personas/svg?seed=User";
const MAX_MESSAGE_CHARS = 2000;

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aborted, setAborted] = useState(false);
  const [inlineError, setInlineError] = useState(""); // inline feedback instead of toast
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const controllerRef = useRef(null);

  const canSend =
    input.trim().length > 0 &&
    input.trim().length <= MAX_MESSAGE_CHARS &&
    !loading;

  async function sendMessage(e) {
    e?.preventDefault?.();
    if (!canSend) return;

    setInlineError(""); // clear previous error

    const userMsg = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
    };

    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setAborted(false);

    try {
      controllerRef.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controllerRef.current.signal,
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();

      const botMsg = {
        role: "assistant",
        content: data.text || "Sorry, I couldn’t generate a response.",
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      if (aborted) {
        setInlineError("Generation stopped.");
      } else {
        setInlineError(
          err?.message || "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
      controllerRef.current = null;
    }
  }

  function stopGeneration() {
    if (controllerRef.current) {
      setAborted(true);
      controllerRef.current.abort();
    }
  }

  // Auto-scroll to bottom on new message or loading start/end
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus textarea on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function formatTime(ts) {
    if (!ts) return "";
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const charCount = input.trim().length;
  const charTooLong = charCount > MAX_MESSAGE_CHARS;

  const groupedMessages = useMemo(() => {
    const groups = [];
    for (const m of messages) {
      const last = groups[groups.length - 1];
      if (last && last.role === m.role) {
        last.items.push(m);
      } else {
        groups.push({ role: m.role, items: [m] });
      }
    }
    return groups;
  }, [messages]);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 lg:p-8 h-screen box-border flex flex-col">
      <Card className="border-muted shadow-m flex flex-col gap-0 flex-1 min-h-0 py-0">
        <Header />

        <Separator />

        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          <ScrollArea
            className="flex-1 min-h-0 px-4"
            style={{ maxHeight: "100%", height: "100%" }}
            ref={scrollRef}
          >
            <div className="py-4 space-y-6">
              {messages.length === 0 ? (
                <EmptyState />
              ) : (
                groupedMessages.map((group, idx) => (
                  <MessageGroup key={idx} role={group.role}>
                    {group.items.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        time={formatTime(msg.timestamp)}
                      />
                    ))}
                  </MessageGroup>
                ))
              )}

              {loading && <AssistantTyping />}
            </div>
          </ScrollArea>
        </CardContent>

        <Separator />

        {/* Inline feedback row (errors / info) */}
        {(inlineError || charTooLong) && (
          <div className="px-4 pt-3">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              <p
                className={cn(
                  "leading-relaxed",
                  charTooLong ? "text-destructive" : "text-amber-700"
                )}
              >
                {charTooLong
                  ? `Message too long (${charCount}/${MAX_MESSAGE_CHARS}).`
                  : inlineError}
              </p>
            </div>
          </div>
        )}

        <CardFooter className="p-4">
          <form
            onSubmit={sendMessage}
            className="flex w-full gap-2 items-end"
          >
            <div className="flex-1 flex flex-col justify-end">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about sales, distributors, trends, or anything else..."
                className={cn(
                  "min-h-[56px] max-h-[160px] resize-y",
                  charTooLong &&
                    "border-destructive focus-visible:ring-destructive"
                )}
                disabled={loading}
              />
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Smart chat
                </Badge>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    charTooLong ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {charCount}/{MAX_MESSAGE_CHARS}
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-start self-stretch">
              <div className="mt-0">
                {loading ? (
                  <Button
                    type="button"
                    variant="primary"
                    className="shrink-0"
                    onClick={stopGeneration}
                    style={{ minHeight: 56 }}
                  >
                    <StopCircle className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="shrink-0"
                    disabled={!canSend}
                    style={{ minHeight: 56 }}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

// Header: keep compact avatar (h-9 w-9)
function Header() {
  return (
    <CardHeader className="flex flex-col items-start justify-between py-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage
            src={BOT_AVATAR}
            alt="Assistant"
            className="h-full w-full object-contain"
          />
          <AvatarFallback>
            <Bot className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-semibold leading-tight">Sales Assistant</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            Online
          </div>
        </div>
      </div>
    </CardHeader>
  );
}

// Empty state: medium avatar (h-14 w-14) but still constrained
function EmptyState() {
  return (
    <div className="flex h-[40vh] flex-col items-center justify-center text-center gap-3 text-muted-foreground">
      <Avatar className="h-14 w-14">
        <AvatarImage
          src={BOT_AVATAR}
          alt="Assistant"
          className="h-full w-full object-contain"
        />
        <AvatarFallback>AI</AvatarFallback>
      </Avatar>
      <div className="max-w-md">
        <p className="text-sm">
          Ask about monthly sales, top distributors, or trends. Try:
        </p>
        <p className="mt-1 text-sm italic">
          “Show top 5 distributors for employee 1023” or “Plot FY 2025 monthly
          sales for 1102”
        </p>
      </div>
    </div>
  );
}

// Message group: small avatars (h-8 w-8)
function MessageGroup({ role, children }) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex w-full gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 mt-0.5 shrink-0">
          <AvatarImage
            src={BOT_AVATAR}
            alt="Assistant"
            className="h-full w-full object-contain"
          />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn("flex max-w-[85%] flex-col gap-1", isUser && "items-end")}
      >
        {children}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 mt-0.5 shrink-0">
          <AvatarImage
            src={USER_AVATAR}
            alt="User"
            className="h-full w-full object-contain"
          />
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

function MessageBubble({ role, content, time }) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "rounded-2xl px-3 py-2 text-sm shadow-sm ring-1 ring-border",
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-muted/60 text-foreground"
      )}
    >
      <div className="whitespace-pre-wrap break-words">{content}</div>
      <div
        className={cn(
          "mt-1 text-[10px] opacity-70",
          isUser ? "text-primary-foreground" : "text-muted-foreground"
        )}
      >
        {time}
      </div>
    </div>
  );
}

function AssistantTyping() {
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8 mt-0.5">
        <AvatarImage src={BOT_AVATAR} alt="Assistant" />
        <AvatarFallback>AI</AvatarFallback>
      </Avatar>
      <div className="rounded-2xl px-3 py-2 text-sm bg-muted/60 ring-1 ring-border shadow-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Assistant is typing…</span>
        </div>
      </div>
    </div>
  );
}
