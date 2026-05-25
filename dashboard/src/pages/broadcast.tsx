import { useState } from "react";
import {
  useGetWhatsAppStatus,
  useListConversations,
  getGetWhatsAppStatusQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  jid: string;
  displayName: string;
  isGroup: boolean;
  messageCount: number;
};

function Avatar({ name, isGroup }: { name: string; isGroup: boolean }) {
  const letter = name.charAt(0).toUpperCase() || "?";
  const hue = ((name.charCodeAt(0) || 65) * 137) % 360;
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ backgroundColor: `hsl(${hue}, 55%, 40%)` }}
    >
      {isGroup ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      ) : letter}
    </div>
  );
}

export default function Broadcast() {
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: status } = useGetWhatsAppStatus({
    query: { queryKey: getGetWhatsAppStatusQueryKey(), refetchInterval: 5000 },
  });
  const { data: conversations } = useListConversations({
    query: { refetchInterval: 30000 },
  });

  const isConnected = status?.state === "connected";
  const convs = (conversations || []) as Conversation[];

  const toggleConv = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setSelectAll(false);
  };

  const toggleAll = () => {
    if (selectAll) {
      setSelectAll(false);
      setSelected(new Set());
    } else {
      setSelectAll(true);
      setSelected(new Set());
    }
  };

  const recipientCount = selectAll ? convs.length : selected.size;

  const handleSend = async () => {
    if (!message.trim() || !isConnected || recipientCount === 0) return;
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const body: { message: string; conversationIds?: string[] } = {
        message: message.trim(),
      };
      if (!selectAll && selected.size > 0) {
        // Map conversation IDs to JIDs
        const selectedConvs = convs.filter((c) => selected.has(c.id));
        body.conversationIds = selectedConvs.map((c) => c.jid);
      }
      const res = await fetch("/api/conversations/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { success: boolean; sent?: number; failed?: number; error?: string };
      if (data.success) {
        setResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
        setMessage("");
      } else {
        setError(data.error ?? "Broadcast failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold">Broadcast</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Send a message to multiple WhatsApp contacts at once.
        </p>
      </div>

      {!isConnected && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3 text-sm text-amber-400">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          WhatsApp is not connected. Go to Connect to pair your account first.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Message composer */}
        <div className="rounded-xl bg-card border border-card-border p-5 space-y-4">
          <h2 className="font-semibold text-sm">Message</h2>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            placeholder="Type your broadcast message here…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            disabled={!isConnected}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{message.length} chars</span>
            <span>
              Sending to <span className="font-semibold text-foreground">{recipientCount}</span> contact{recipientCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Result / Error */}
          {result && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 p-3 text-sm text-emerald-400 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Sent to {result.sent} contact{result.sent !== 1 ? "s" : ""}
              {result.failed > 0 && `, ${result.failed} failed`}.
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-3 text-sm text-red-400 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleSend}
            disabled={!isConnected || !message.trim() || recipientCount === 0 || sending}
          >
            {sending ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> Sending…</>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
                Send to {recipientCount} contact{recipientCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground/60 text-center">
            A small delay is added between sends to respect WhatsApp limits.
          </p>
        </div>

        {/* Recipient picker */}
        <div className="rounded-xl bg-card border border-card-border overflow-hidden flex flex-col max-h-[480px]">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">Recipients</h2>
            <button
              onClick={toggleAll}
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-full border transition-colors",
                selectAll
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {selectAll ? "All selected" : "Select all"}
            </button>
          </div>

          {convs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-center px-4">
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {convs.map((conv) => {
                const isSelected = selectAll || selected.has(conv.id);
                return (
                  <button
                    key={conv.id}
                    onClick={() => toggleConv(conv.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/30",
                      !selectAll && selected.has(conv.id) && "bg-primary/5"
                    )}
                  >
                    <Avatar name={conv.displayName} isGroup={conv.isGroup} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.displayName}</p>
                      <p className="text-xs text-muted-foreground">{conv.messageCount} messages</p>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors",
                      isSelected ? "bg-primary border-primary" : "border-border"
                    )}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
