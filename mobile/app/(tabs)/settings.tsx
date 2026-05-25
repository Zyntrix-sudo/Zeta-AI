import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetSettingsQueryKey(),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Platform.OS !== "web" &&
          Alert.alert("Saved", "Settings updated successfully.");
      },
    },
  });

  const [enabled, setEnabled] = useState(true);
  const [aiPersona, setAiPersona] = useState("");
  const [replyPrefix, setReplyPrefix] = useState("");
  const [ignoreSelf, setIgnoreSelf] = useState(true);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setAiPersona(settings.aiPersona);
      setReplyPrefix(settings.replyPrefix || "");
      setIgnoreSelf(settings.ignoreSelf);
      setGreeting(settings.greeting);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      data: {
        enabled,
        aiPersona,
        replyPrefix: replyPrefix.trim() || null,
        ignoreSelf,
        greeting,
      },
    });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 80;

  const s = styles(colors, topPad, bottomPad);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      {/* AI Toggle */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Auto-Responder</Text>
        <View style={s.row}>
          <View style={s.rowInfo}>
            <Text style={s.rowLabel}>Enable AI Replies</Text>
            <Text style={s.rowDesc}>
              Automatically reply to incoming messages
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={s.row}>
          <View style={s.rowInfo}>
            <Text style={s.rowLabel}>Ignore Self Messages</Text>
            <Text style={s.rowDesc}>
              Don't reply to messages you send yourself
            </Text>
          </View>
          <Switch
            value={ignoreSelf}
            onValueChange={setIgnoreSelf}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Prefix Filter */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Prefix Filter</Text>
        <View style={s.inputGroup}>
          <Text style={s.label}>Reply Prefix (optional)</Text>
          <TextInput
            style={[s.input]}
            value={replyPrefix}
            onChangeText={setReplyPrefix}
            placeholder="e.g. !ai (leave blank to reply to all)"
            placeholderTextColor={colors.mutedForeground}
          />
          <Text style={s.hint}>
            If set, the AI only replies to messages starting with this prefix.
          </Text>
        </View>
      </View>

      {/* AI Persona */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>AI Persona</Text>
        <View style={s.inputGroup}>
          <Text style={s.label}>System Prompt</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={aiPersona}
            onChangeText={setAiPersona}
            placeholder="Describe how the AI should behave..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
        <View style={s.inputGroup}>
          <Text style={s.label}>Greeting Message</Text>
          <TextInput
            style={[s.input]}
            value={greeting}
            onChangeText={setGreeting}
            placeholder="First message sent to new contacts"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[s.saveBtn, updateSettings.isPending && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={updateSettings.isPending}
        activeOpacity={0.85}
      >
        {updateSettings.isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Feather name="save" size={18} color="#fff" />
        )}
        <Text style={s.saveBtnText}>
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Text>
      </TouchableOpacity>

      {/* API Info */}
      <View style={s.infoBox}>
        <Feather name="cpu" size={14} color={colors.mutedForeground} />
        <Text style={s.infoText}>
          Powered by custom Gemini AI. The AI remembers each conversation
          separately, so returning contacts are recognised automatically.
        </Text>
      </View>
    </ScrollView>
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
      paddingBottom: bottomPad,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: topPad,
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    section: {
      marginTop: 16,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 20,
      paddingVertical: 4,
    },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginTop: 12,
      marginBottom: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rowInfo: {
      flex: 1,
      marginRight: 16,
    },
    rowLabel: {
      fontSize: 16,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    rowDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    inputGroup: {
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    hint: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    textarea: {
      minHeight: 100,
      paddingTop: 10,
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.primary,
      marginHorizontal: 20,
      marginTop: 24,
      paddingVertical: 14,
      borderRadius: colors.radius,
    },
    saveBtnText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    infoBox: {
      flexDirection: "row",
      gap: 8,
      marginHorizontal: 20,
      marginTop: 16,
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
