import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useGetConversationMessages, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useEffect } from "react";

type Message = {
  id: string;
  conversationId: string;
  content: string;
  role: string;
  senderName: string | null;
  timestamp: string;
  isAiReply: boolean;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const { data: messages, isLoading } = useGetConversationMessages(id || "", {
    query: {
      enabled: !!id,
      refetchInterval: 5000,
      queryKey: getGetConversationMessagesQueryKey(id || ""),
    },
  });

  useEffect(() => {
    navigation.setOptions({
      title: "Conversation",
      headerStyle: { backgroundColor: colors.card },
      headerTintColor: colors.foreground,
    });
  }, [navigation, colors]);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 20;
  const s = styles(colors, bottomPad);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: Message }) => {
    const isAI = item.role === "assistant";
    return (
      <View style={[s.bubble, isAI ? s.bubbleAI : s.bubbleUser]}>
        {isAI && (
          <View style={s.aiLabel}>
            <Feather name="zap" size={10} color={colors.aiLabel} />
            <Text style={[s.aiLabelText, { color: colors.aiLabel }]}>AI</Text>
          </View>
        )}
        {!isAI && item.senderName && (
          <Text style={s.senderName}>{item.senderName}</Text>
        )}
        <Text style={[s.bubbleText, isAI ? s.textAI : s.textUser]}>
          {item.content}
        </Text>
        <Text style={s.timestamp}>{formatTime(item.timestamp)}</Text>
      </View>
    );
  };

  return (
    <View style={s.container}>
      {!messages || messages.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No messages yet</Text>
        </View>
      ) : (
        <FlatList
          data={messages as Message[]}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[s.list, { paddingBottom: bottomPad }]}
          inverted={false}
        />
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, bottomPad: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    list: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    bubble: {
      maxWidth: "80%",
      marginBottom: 10,
      padding: 12,
      borderRadius: 14,
      gap: 4,
    },
    bubbleUser: {
      alignSelf: "flex-start",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleAI: {
      alignSelf: "flex-end",
      backgroundColor: colors.primary + "18",
      borderWidth: 1,
      borderColor: colors.primary + "40",
    },
    aiLabel: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 2,
    },
    aiLabelText: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    senderName: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
      marginBottom: 2,
    },
    bubbleText: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      lineHeight: 21,
    },
    textUser: {
      color: colors.foreground,
    },
    textAI: {
      color: colors.foreground,
    },
    timestamp: {
      fontSize: 10,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      alignSelf: "flex-end",
      marginTop: 2,
    },
    emptyText: {
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
  });
