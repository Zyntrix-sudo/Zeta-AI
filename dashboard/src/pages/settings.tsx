import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-card-border overflow-hidden">
      <div className="px-6 py-5 border-b border-border">
        <h3 className="font-semibold text-sm">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0 mt-0.5">{children}</div>
    </div>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });

  const update = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    },
  });

  const [enabled, setEnabled] = useState(true);
  const [ignoreSelf, setIgnoreSelf] = useState(true);
  const [aiPersona, setAiPersona] = useState("");
  const [replyPrefix, setReplyPrefix] = useState("");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setIgnoreSelf(settings.ignoreSelf);
      setAiPersona(settings.aiPersona);
      setReplyPrefix(settings.replyPrefix || "");
      setGreeting(settings.greeting);
    }
  }, [settings]);

  const handleSave = () => {
    update.mutate({
      data: {
        enabled,
        ignoreSelf,
        aiPersona,
        replyPrefix: replyPrefix.trim() || null,
        greeting,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how the AI auto-responder behaves.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={update.isPending}
          className="shrink-0"
        >
          {update.isPending ? (
            <span className="w-4 h-4 border-2 border-primary-foreground/50 border-t-transparent rounded-full animate-spin" />
          ) : saved ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Saved
            </>
          ) : "Save Changes"}
        </Button>
      </div>

      {/* Auto-responder */}
      <Section
        title="Auto-Responder"
        description="Control when and how the AI responds to messages."
      >
        <Field label="Enable AI Replies" description="Automatically reply to incoming WhatsApp messages.">
          <Toggle checked={enabled} onChange={setEnabled} />
        </Field>
        <Field label="Ignore Self Messages" description="Don't process or reply to messages you send yourself.">
          <Toggle checked={ignoreSelf} onChange={setIgnoreSelf} />
        </Field>
      </Section>

      {/* Prefix filter */}
      <Section
        title="Trigger Filter"
        description="Optionally limit the AI to only reply to specific messages."
      >
        <div className="space-y-2">
          <label className="text-sm font-medium block">Reply Prefix</label>
          <Input
            type="text"
            placeholder="e.g. !ai (leave blank to reply to all messages)"
            value={replyPrefix}
            onChange={e => setReplyPrefix(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            If set, the AI only replies to messages that start with this prefix. The prefix is stripped before sending to the AI.
          </p>
        </div>
      </Section>

      {/* AI Persona */}
      <Section
        title="AI Persona"
        description="Customise the AI's personality and behaviour."
      >
        <div className="space-y-2">
          <label className="text-sm font-medium block">System Prompt</label>
          <textarea
            value={aiPersona}
            onChange={e => setAiPersona(e.target.value)}
            rows={5}
            placeholder="Describe how the AI should behave..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <p className="text-xs text-muted-foreground">
            The AI will always use standard English and remember each conversation independently.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">Greeting Message</label>
          <Input
            type="text"
            placeholder="Hello! I'm an AI assistant. How can I help you today?"
            value={greeting}
            onChange={e => setGreeting(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            This is sent as the AI's first message to new contacts (if triggered).
          </p>
        </div>
      </Section>

      {/* Info */}
      <div className="rounded-xl bg-accent/30 border border-accent-border p-5 flex gap-3">
        <svg className="w-4 h-4 text-accent-foreground shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-accent-foreground">AI Memory</p>
          <p className="text-xs text-accent-foreground/70 mt-1 leading-relaxed">
            The AI uses each contact's WhatsApp JID as a unique session ID, so it automatically remembers conversations per contact. Changing the system prompt may affect ongoing conversations.
          </p>
        </div>
      </div>
    </div>
  );
}
