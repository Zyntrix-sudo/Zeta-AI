import { useState } from "react";
import {
  useListConversations,
  useGetConversationMessages,
  getGetConversationMessagesQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  jid: string;
  displayName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  isGroup: boolean;
};

type Message = {
  id: string;
  content: string;
  role: string;
  senderName: string | null;
  timestamp: string;
  isAiReply: boolean;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Avatar({ name, isGroup }: { name: string; isGroup: boolean }) {
  const letter = name.charAt(0).toUpperCase() || "?";
  const hue = ((name.charCodeAt(0) || 65) * 137) % 360;
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
      style={{ backgroundColor: `hsl(${hue}, 55%, 40%)` }}
    >
      {isGroup ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      ) : letter}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isAI = msg.role === "assistant";
  return (
    <div className={cn("flex gap-2", isAI ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
          isAI
            ? "bg-primary/15 border border-primary/25 rounded-tr-sm"
            : "bg-card border border-card-border rounded-tl-sm"
        )}
      >
        {!isAI && msg.senderName && (
          <p className="text-xs font-semibold text-primary mb-1">{msg.senderName}</p>
        )}
        {isAI && (
          <p className="text-xs font-semibold text-primary/80 mb-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.818a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .845-.143Z" clipRule="evenodd" />
            </svg>
            AI
          </p>
        )}
        <p className="leading-relaxed">{msg.content}</p>
        <p className="text-xs text-muted-foreground/60 mt-1 text-right">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

export default function Conversations() {
  const [selected, setSelected] = useState<Conversation | null>(null);

  const { data: conversations, isLoading } = useListConversations({
    query: { refetchInterval: 10000 },
  });

  const { data: messages, isLoading: msgsLoading } = useGetConversationMessages(
    selected?.id || "",
    {
      query: {
        enabled: !!selected,
        refetchInterval: 5000,
        queryKey: getGetConversationMessagesQueryKey(selected?.id || ""),
      },
    }
  );

  return (
    <div className="flex h-full">
      {/* Sidebar list */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Conversations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {conversations?.length || 0} total
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !conversations || conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Messages will appear once people message your WhatsApp.
              </p>
            </div>
          ) : (
            (conversations as Conversation[]).map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 hover:bg-muted/40",
                  selected?.id === conv.id && "bg-muted"
                )}
              >
                <Avatar name={conv.displayName} isGroup={conv.isGroup} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium truncate">{conv.displayName}</p>
                    <p className="text-xs text-muted-foreground shrink-0">{timeAgo(conv.lastMessageAt)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.lastMessage || "No messages"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <Avatar name={selected.displayName} isGroup={selected.isGroup} />
              <div>
                <p className="font-semibold text-sm">{selected.displayName}</p>
                <p className="text-xs text-muted-foreground font-mono">{selected.jid}</p>
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                {selected.messageCount} messages
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {msgsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !messages || messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No messages loaded.</p>
                </div>
              ) : (
                (messages as Message[]).map(msg => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </div>
            <p className="font-medium text-muted-foreground">Select a conversation</p>
            <p className="text-sm text-muted-foreground/60">
              Choose a conversation from the list to view messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
