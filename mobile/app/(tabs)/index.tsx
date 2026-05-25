import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useGetWhatsAppStatus,
  useConnectWhatsApp,
  useDisconnectWhatsApp,
  useRequestPairingCode,
  getGetWhatsAppStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

type ConnectionState = "disconnected" | "connecting" | "pairing" | "connected";

const STATE_COLORS: Record<ConnectionState, string> = {
  disconnected: "#ef4444",
  connecting: "#f59e0b",
  pairing: "#3b82f6",
  connected: "#00a884",
};

const STATE_LABELS: Record<ConnectionState, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  pairing: "Awaiting pairing",
  connected: "Connected",
};

export default function StatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useGetWhatsAppStatus({
    query: {
      refetchInterval: 3000,
      queryKey: getGetWhatsAppStatusQueryKey(),
    },
  });

  const connect = useConnectWhatsApp({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getGetWhatsAppStatusQueryKey(),
        }),
    },
  });

  const disconnect = useDisconnectWhatsApp({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getGetWhatsAppStatusQueryKey(),
        }),
    },
  });

  const connectQR = useCallback(() => {
    connect.mutate({ data: { mode: "qr" } });
  }, [connect]);

  const connectPair = useCallback(() => {
    connect.mutate({ data: { mode: "pair" } });
  }, [connect]);

  const doDisconnect = useCallback(() => {
    disconnect.mutate({});
  }, [disconnect]);

  const state = (status?.state || "disconnected") as ConnectionState;
  const stateColor = STATE_COLORS[state];
  const stateLabel = STATE_LABELS[state];
  const isConnected = state === "connected";
  const isPairing = state === "pairing";

  const topPad =
    Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 80;

  const s = styles(colors, topPad, bottomPad);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.logoRow}>
          <Feather name="zap" size={24} color={colors.primary} />
          <Text style={s.appTitle}>WhatsApp AI</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: stateColor + "20" }]}>
          <View style={[s.statusDot, { backgroundColor: stateColor }]} />
          <Text style={[s.statusText, { color: stateColor }]}>
            {stateLabel}
          </Text>
        </View>
      </View>

      {/* Connection Card */}
      <View style={s.card}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : isConnected ? (
          <ConnectedView
            colors={colors}
            phoneNumber={status?.phoneNumber || ""}
            displayName={status?.displayName || ""}
            connectedAt={status?.connectedAt || ""}
            s={s}
          />
        ) : isPairing ? (
          <PairingView
            colors={colors}
            qrCode={status?.qrCode || null}
            pairingCode={status?.pairingCode || null}
            s={s}
          />
        ) : (
          <DisconnectedView colors={colors} s={s} />
        )}
      </View>

      {/* Action Buttons */}
      {!isConnected && !isPairing && (
        <View style={s.buttonGroup}>
          <TouchableOpacity
            style={[s.btn, s.btnPrimary]}
            onPress={connectQR}
            disabled={connect.isPending}
            activeOpacity={0.85}
          >
            <Feather name="camera" size={18} color="#fff" />
            <Text style={s.btnPrimaryText}>
              {connect.isPending ? "Starting..." : "Connect via QR"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnSecondary]}
            onPress={connectPair}
            disabled={connect.isPending}
            activeOpacity={0.85}
          >
            <Feather name="smartphone" size={18} color={colors.primary} />
            <Text style={s.btnSecondaryText}>Link with Phone Number</Text>
          </TouchableOpacity>
        </View>
      )}

      {isPairing && (
        <TouchableOpacity
          style={[s.btn, s.btnDanger]}
          onPress={doDisconnect}
          activeOpacity={0.85}
        >
          <Feather name="x-circle" size={18} color="#fff" />
          <Text style={s.btnPrimaryText}>Cancel</Text>
        </TouchableOpacity>
      )}

      {isConnected && (
        <TouchableOpacity
          style={[s.btn, s.btnDanger]}
          onPress={doDisconnect}
          disabled={disconnect.isPending}
          activeOpacity={0.85}
        >
          <Feather name="log-out" size={18} color="#fff" />
          <Text style={s.btnPrimaryText}>
            {disconnect.isPending ? "Disconnecting..." : "Disconnect"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Info */}
      <View style={s.infoBox}>
        <Feather name="info" size={14} color={colors.mutedForeground} />
        <Text style={s.infoText}>
          The AI auto-responder replies to incoming WhatsApp messages
          automatically. Configure behaviour in Settings.
        </Text>
      </View>
    </ScrollView>
  );
}

function ConnectedView({
  colors,
  phoneNumber,
  displayName,
  connectedAt,
  s,
}: {
  colors: ReturnType<typeof useColors>;
  phoneNumber: string;
  displayName: string;
  connectedAt: string;
  s: ReturnType<typeof styles>;
}) {
  const since = connectedAt
    ? new Date(connectedAt).toLocaleString()
    : "Unknown";
  return (
    <View style={s.connectedContent}>
      <View style={[s.bigIcon, { backgroundColor: "#00a88420" }]}>
        <Feather name="check-circle" size={48} color="#00a884" />
      </View>
      <Text style={s.connectedName}>{displayName || "WhatsApp"}</Text>
      <Text style={s.connectedPhone}>{phoneNumber}</Text>
      <Text style={s.connectedSince}>Connected since {since}</Text>
    </View>
  );
}

function PairingView({
  colors,
  qrCode,
  pairingCode,
  s,
}: {
  colors: ReturnType<typeof useColors>;
  qrCode: string | null;
  pairingCode: string | null;
  s: ReturnType<typeof styles>;
}) {
  if (pairingCode) {
    return (
      <View style={s.pairingContent}>
        <Text style={s.pairingTitle}>Your Pairing Code</Text>
        <View style={s.codeBox}>
          <Text style={[s.pairingCode, { color: colors.primary }]}>
            {pairingCode}
          </Text>
        </View>
        <Text style={s.pairingHint}>
          Open WhatsApp → Linked Devices → Link with Phone Number → Enter code
        </Text>
      </View>
    );
  }
  if (qrCode) {
    return (
      <View style={s.pairingContent}>
        <Text style={s.pairingTitle}>Scan QR Code</Text>
        <Image
          source={{ uri: qrCode }}
          style={s.qrImage}
          resizeMode="contain"
        />
        <Text style={s.pairingHint}>
          Open WhatsApp → Linked Devices → Link a Device → Scan QR
        </Text>
      </View>
    );
  }
  return (
    <View style={s.pairingContent}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={s.pairingHint}>Generating QR code...</Text>
    </View>
  );
}

function DisconnectedView({
  colors,
  s,
}: {
  colors: ReturnType<typeof useColors>;
  s: ReturnType<typeof styles>;
}) {
  return (
    <View style={s.connectedContent}>
      <View style={[s.bigIcon, { backgroundColor: "#ef444420" }]}>
        <Feather name="wifi-off" size={48} color="#ef4444" />
      </View>
      <Text style={s.connectedName}>Not Connected</Text>
      <Text style={[s.connectedPhone, { color: colors.mutedForeground }]}>
        Connect your WhatsApp to enable AI auto-replies
      </Text>
    </View>
  );
}

const styles = (
  colors: ReturnType<typeof useColors>,
  topPad: number,
  bottomPad: number,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingTop: topPad,
      paddingBottom: bottomPad,
      paddingHorizontal: 20,
      gap: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    appTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 260,
      justifyContent: "center",
    },
    connectedContent: {
      alignItems: "center",
      gap: 10,
    },
    bigIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    connectedName: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    connectedPhone: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    connectedSince: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 4,
    },
    pairingContent: {
      alignItems: "center",
      gap: 16,
      width: "100%",
    },
    pairingTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    qrImage: {
      width: 220,
      height: 220,
      borderRadius: 8,
    },
    codeBox: {
      backgroundColor: colors.secondary,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 16,
      alignItems: "center",
    },
    pairingCode: {
      fontSize: 32,
      fontFamily: "Inter_700Bold",
      letterSpacing: 4,
    },
    pairingHint: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },
    buttonGroup: {
      gap: 12,
    },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 14,
      borderRadius: colors.radius,
    },
    btnPrimary: {
      backgroundColor: colors.primary,
    },
    btnSecondary: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    btnDanger: {
      backgroundColor: colors.destructive,
    },
    btnPrimaryText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    btnSecondaryText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    infoBox: {
      flexDirection: "row",
      gap: 8,
      backgroundColor: colors.muted,
      borderRadius: 10,
      padding: 14,
      alignItems: "flex-start",
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
    },
  });
