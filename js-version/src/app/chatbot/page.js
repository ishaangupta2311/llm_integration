// js-version/src/app/chat/page.js
"use client";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useEffect, useState } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });
    const data = await res.json();
    setMessages([...newMessages, { role: "assistant", content: data.text }]);
    setLoading(false);
  }

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <Card className="w-full max-w-xl shadow-2xl border-none bg-gray-950">
        <CardHeader>
          <h1 className="text-3xl font-bold text-center text-blue-400 mb-2">
            Gemini Chatbot
          </h1>
          <p className="text-center text-gray-400 text-sm">
            Ask about sales, distributors, or anything else!
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea
            className="h-96 rounded-md border bg-gray-900 p-4 mb-4"
            ref={scrollRef}
          >
            <div className="flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 italic">
                  Start the conversation…
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white self-end"
                        : "bg-gray-800 text-blue-200 self-start"
                    }`}
                  >
                    <span className="block text-xs mb-1 opacity-70">
                      {msg.role === "user" ? "You" : "Gemini"}
                    </span>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-4 py-2 bg-gray-800 text-blue-200 animate-pulse">
                    Gemini is typing…
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <form onSubmit={sendMessage} className="flex gap-2">
            <Input
              className="flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              disabled={loading}
              autoFocus
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
