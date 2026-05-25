import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWhatsAppStatus,
  useGetStats,
  useConnectWhatsApp,
  useDisconnectWhatsApp,
  useRequestPairingCode,
  getGetWhatsAppStatusQueryKey,
  getGetStatsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATE_BADGE: Record<string, string> = {
  connected: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  pairing: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  connecting: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  disconnected: "bg-red-500/15 text-red-400 border border-red-500/30",
};
const STATE_LABEL: Record<string, string> = {
  connected: "Connected", pairing: "Pairing", connecting: "Connecting…", disconnected: "Disconnected",
};
const DOT: Record<string, string> = {
  connected: "bg-emerald-400", pairing: "bg-blue-400", connecting: "bg-amber-400", disconnected: "bg-red-400",
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card border border-card-border p-4 flex flex-col gap-1">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.replace(/-/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: select text */
    }
  };
  return (
    <button
      onClick={copy}
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all",
        copied
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:border-primary/40"
      )}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
          </svg>
          Copy code
        </>
      )}
    </button>
  );
}

export default function Connect() {
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [pairError, setPairError] = useState<string | null>(null);

  const { data: status, isLoading } = useGetWhatsAppStatus({
    query: { queryKey: getGetWhatsAppStatusQueryKey(), refetchInterval: 3000 },
  });
  const { data: stats } = useGetStats({
    query: { queryKey: getGetStatsQueryKey(), refetchInterval: 10000 },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetWhatsAppStatusQueryKey() });
    qc.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  };

  const connectQR = useConnectWhatsApp({ mutation: { onSuccess: refresh } });
  const connectPair = useRequestPairingCode({
    mutation: {
      onSuccess: (data) => {
        refresh();
        if (!data.success) setPairError(data.message ?? "Failed to generate code");
      },
      onError: () => setPairError("Request failed. Check phone number and try again."),
    },
  });
  const disconnect = useDisconnectWhatsApp({ mutation: { onSuccess: refresh } });

  const state = (status?.state || "disconnected") as string;
  const isConnected = state === "connected";
  const isPairing = state === "pairing";

  const handleConnectQR = () => {
    setPairError(null);
    connectQR.mutate({ data: { mode: "qr" } });
  };
  const handleConnectPair = () => {
    if (!phone.trim()) return;
    setPairError(null);
    connectPair.mutate({ data: { phoneNumber: phone.replace(/[^0-9]/g, "") } });
  };

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold">WhatsApp Connection</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pair your account to enable AI auto-replies.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Messages" value={stats?.totalMessages ?? 0} />
        <Stat label="Conversations" value={stats?.totalConversations ?? 0} />
        <Stat label="AI Replies" value={stats?.aiReplies ?? 0} />
        <Stat label="Today" value={stats?.activeToday ?? 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Status card */}
        <div className="rounded-xl bg-card border border-card-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Status</h2>
            <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", STATE_BADGE[state])}>
              <span className={cn("w-1.5 h-1.5 rounded-full", DOT[state])} />
              {STATE_LABEL[state]}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isConnected ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold">{status?.displayName || "Connected"}</p>
                <p className="text-muted-foreground text-sm font-mono">{status?.phoneNumber}</p>
                {status?.connectedAt && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Since {new Date(status.connectedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <Button variant="destructive" className="w-full" onClick={() => disconnect.mutate({})} disabled={disconnect.isPending}>
                {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
              </Button>
            </div>
          ) : isPairing ? (
            <div className="flex flex-col items-center gap-4">
              {status?.qrCode ? (
                <>
                  <p className="text-sm text-muted-foreground">Scan with WhatsApp</p>
                  <div className="p-2 bg-white rounded-xl shadow-lg">
                    <img src={status.qrCode} alt="QR Code" className="w-48 h-48 rounded-lg" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    WhatsApp → Linked Devices → Link a Device → Scan QR
                  </p>
                </>
              ) : status?.pairingCode ? (
                <>
                  <p className="text-sm text-muted-foreground">Enter this code in WhatsApp</p>
                  <div className="bg-muted rounded-xl px-6 py-4 text-center w-full">
                    <p className="text-3xl font-bold tracking-[0.35em] font-mono text-primary">
                      {status.pairingCode}
                    </p>
                  </div>
                  <CopyButton text={status.pairingCode} />
                  <p className="text-xs text-muted-foreground text-center">
                    WhatsApp → Linked Devices → Link with Phone Number
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Generating pairing code…</p>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => disconnect.mutate({})}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground text-center">Not connected. Choose a pairing method.</p>
            </div>
          )}
        </div>

        {/* Pairing panel */}
        {!isConnected && !isPairing && (
          <div className="rounded-xl bg-card border border-card-border p-5 space-y-5">
            <h2 className="font-semibold text-sm">Pair Your Account</h2>

            {/* QR */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <p className="text-sm font-medium">Connect via QR Code</p>
              </div>
              <p className="text-xs text-muted-foreground pl-7">Scan the QR with WhatsApp. Fastest method.</p>
              <div className="pl-7">
                <Button className="w-full" onClick={handleConnectQR} disabled={connectQR.isPending}>
                  {connectQR.isPending ? (
                    <><span className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /> Starting…</>
                  ) : "Generate QR Code"}
                </Button>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Phone number */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <p className="text-sm font-medium">Link with Phone Number</p>
              </div>
              <p className="text-xs text-muted-foreground pl-7">
                Get an 8-digit pairing code sent to your phone.
              </p>
              <div className="pl-7 space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="2348012345678"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setPairError(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handleConnectPair()}
                    className="font-mono"
                  />
                  <Button onClick={handleConnectPair} disabled={connectPair.isPending || !phone.trim()}>
                    {connectPair.isPending
                      ? <span className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                      : "Pair"}
                  </Button>
                </div>
                {pairError && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    {pairError}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/60">
                  Country code + digits only, no + or spaces. E.g. 2348012345678
                </p>
              </div>
            </div>
          </div>
        )}

        {isPairing && (
          <div className="rounded-xl bg-card border border-card-border p-5 space-y-3">
            <h2 className="font-semibold text-sm">How to Pair</h2>
            {status?.qrCode ? (
              <ol className="space-y-2.5">
                {["Open WhatsApp on your phone", "Tap Menu (⋮) or Settings", "Tap Linked Devices", "Tap Link a Device", "Point camera at the QR code"].map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-muted shrink-0 flex items-center justify-center text-xs font-bold text-foreground/60">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            ) : (
              <ol className="space-y-2.5">
                {["Open WhatsApp on your phone", "Tap Menu (⋮) or Settings", "Tap Linked Devices", "Tap Link with Phone Number", "Enter the 8-digit code shown"].map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-muted shrink-0 flex items-center justify-center text-xs font-bold text-foreground/60">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
