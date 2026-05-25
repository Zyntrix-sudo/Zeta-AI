import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useListConversations } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type Conversation = {
  id: string;
  jid: string;
  displayName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  unreadCount: number;
  isGroup: boolean;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Avatar({
  name,
  isGroup,
  colors,
}: {
  name: string;
  isGroup: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const letter = name.charAt(0).toUpperCase() || "?";
  const hue = ((name.charCodeAt(0) || 0) * 137) % 360;
  const bg = `hsl(${hue}, 55%, 45%)`;
  return (
    <View
      style={[
        avatarStyles.avatar,
        { backgroundColor: bg, borderRadius: colors.radius },
      ]}
    >
      {isGroup ? (
        <Feather name="users" size={20} color="#fff" />
      ) : (
        <Text style={avatarStyles.letter}>{letter}</Text>
      )}
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  avatar: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});

export default function ConversationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: conversations, isLoading } = useListConversations({
    query: { refetchInterval: 10000 },
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 70;

  const s = styles(colors, topPad, bottomPad);

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={s.item}
      activeOpacity={0.7}
      onPress={() => router.push(`/conversation/${item.id}` as never)}
    >
      <Avatar name={item.displayName} isGroup={item.isGroup} colors={colors} />
      <View style={s.itemContent}>
        <View style={s.itemTop}>
          <Text style={s.itemName} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={s.itemTime}>{timeAgo(item.lastMessageAt)}</Text>
        </View>
        <View style={s.itemBottom}>
          <Text style={s.itemLast} numberOfLines={1}>
            {item.lastMessage || "No messages yet"}
          </Text>
          {item.messageCount > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{item.messageCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <Text style={s.headerTitle}>Conversations</Text>
        <View style={s.aiBadge}>
          <Feather name="zap" size={12} color={colors.primary} />
          <Text style={s.aiBadgeText}>AI Active</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !conversations || conversations.length === 0 ? (
        <View style={s.center}>
          <Feather name="message-circle" size={48} color={colors.muted} />
          <Text style={s.emptyTitle}>No conversations yet</Text>
          <Text style={s.emptyText}>
            Conversations will appear here once people message your connected
            WhatsApp number.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations as Conversation[]}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          ItemSeparatorComponent={() => (
            <View
              style={[s.separator, { backgroundColor: colors.border }]}
            />
          )}
        />
      )}
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    aiBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    aiBadgeText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.card,
    },
    itemContent: {
      flex: 1,
      gap: 4,
    },
    itemTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    itemName: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      flex: 1,
      marginRight: 8,
    },
    itemTime: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    itemBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    itemLast: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      flex: 1,
      marginRight: 8,
    },
    countBadge: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      minWidth: 22,
      height: 22,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    countText: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      color: "#fff",
    },
    separator: {
      height: 1,
      marginLeft: 84,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 21,
    },
  });
