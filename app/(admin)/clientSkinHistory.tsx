import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING } from '../../src/constants/theme';
import { useClientsWithProfiles } from '../../src/hooks/useClientsWithProfiles';
import { db } from "../../src/lib/firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClientRow {
  id: string;
  fullName: string;
  email: string;
  streak: number;
}

interface SkinLog {
  id: string;
  clientId: string;
  date: Timestamp;
  hydration: number;
  oiliness: number;
  sensitivity: number;
  brightness: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METRIC_CONFIG = [
  { key: "hydration" as const,   label: "Hydration",   color: "#4ecdc4" },
  { key: "oiliness" as const,    label: "Oiliness",    color: "#ff6b6b" },
  { key: "sensitivity" as const, label: "Sensitivity", color: "#f7b731" },
  { key: "brightness" as const,  label: "Brightness",  color: "#a29bfe" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricBar({ value, color, label }: { value: number; color: string; label: string }) {
  const clampedValue = Math.min(100, Math.max(0, value ?? 0));
  return (
    <View style={styles.metricWrapper}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${clampedValue}%` as any, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[styles.metricValue, { color }]}>{clampedValue}</Text>
    </View>
  );
}

function SkinLogCard({ log }: { log: SkinLog }) {
  const dateStr = log.date?.toDate
    ? log.date.toDate().toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "N/A";

  return (
    <View style={styles.logCard}>
      <View style={styles.logDateRow}>
        <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
        <Text style={styles.logDate}>{dateStr}</Text>
      </View>
      <View style={styles.metricsRow}>
        {METRIC_CONFIG.map(({ key, label, color }) => (
          <MetricBar key={key} value={log[key]} color={color} label={label} />
        ))}
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientSkinHistory() {
  const { clients: rawClients, loading } = useClientsWithProfiles();
  const clients: ClientRow[] = rawClients.map(c => ({
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    streak: c.streak ?? 0,
  }));
  const [filteredClients, setFilteredClients] = useState<ClientRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [skinLogsMap, setSkinLogsMap] = useState<Record<string, SkinLog[]>>({});
  const [loadingLogsFor, setLoadingLogsFor] = useState<string | null>(null);

  // ── 2. Keep filtered list in sync with search ──
  useEffect(() => {
    applyFilter(clients, searchQuery);
  }, [searchQuery, clients]);

  const applyFilter = (list: ClientRow[], q: string) => {
    if (!q.trim()) {
      setFilteredClients(list);
      return;
    }
    const lower = q.toLowerCase();
    setFilteredClients(
      list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(lower) ||
          c.email.toLowerCase().includes(lower)
      )
    );
  };

  // ── 3. Fetch skin logs on expand (getDocs, cached) ──
  const handleToggle = useCallback(
    async (clientId: string) => {
      if (expandedId === clientId) {
        setExpandedId(null);
        return;
      }

      setExpandedId(clientId);

      // Return early if already cached
      if (skinLogsMap[clientId]) return;

      setLoadingLogsFor(clientId);
      try {
        const q = query(
          collection(db, "skinLogs"),
          where("clientId", "==", clientId),
          orderBy("date", "desc")
        );
        const snap = await getDocs(q);
        const logs: SkinLog[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SkinLog, "id">),
        }));

        setSkinLogsMap((prev) => ({ ...prev, [clientId]: logs }));
      } catch (err) {
        console.error("Failed to fetch skin logs:", err);
        setSkinLogsMap((prev) => ({ ...prev, [clientId]: [] }));
      } finally {
        setLoadingLogsFor(null);
      }
    },
    [expandedId, skinLogsMap]
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Page header */}
        <View style={styles.pageHeader}>
          <Ionicons name="pulse-outline" size={24} color={COLORS.primary} />
          <Text style={styles.pageTitle}>Skin Analysis History</Text>
        </View>
        <Text style={styles.pageSubtitle}>
          Tap a client to view their logged skin metrics over time.
        </Text>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Loading state */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: 60 }}
          />
        ) : filteredClients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={52} color={COLORS.border} />
            <Text style={styles.emptyText}>
              {searchQuery ? "No clients match your search." : "No clients found."}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            <Text style={styles.resultsCount}>
              {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
            </Text>

            {filteredClients.map((client) => {
              const isExpanded = expandedId === client.id;
              const logs = skinLogsMap[client.id];
              const isLoadingLogs = loadingLogsFor === client.id;

              return (
                <View key={client.id} style={styles.clientCard}>
                  {/* ── Client header row (tap to expand) ── */}
                  <Pressable
                    style={styles.clientHeader}
                    onPress={() => handleToggle(client.id)}
                    android_ripple={{ color: COLORS.border }}
                  >
                    {/* Avatar */}
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {client.fullName.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {/* Name / email */}
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName} numberOfLines={1}>
                        {client.fullName}
                      </Text>
                      <Text style={styles.clientEmail} numberOfLines={1}>
                        {client.email || "No email"}
                      </Text>
                    </View>

                    {/* Streak badge */}
                    <View style={styles.streakBadge}>
                      <Text style={styles.streakIcon}>🔥</Text>
                      <Text style={styles.streakText}>{client.streak}</Text>
                    </View>

                    {/* Chevron */}
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={COLORS.textSecondary}
                      style={{ marginLeft: 6 }}
                    />
                  </Pressable>

                  {/* ── Expanded skin log panel ── */}
                  {isExpanded && (
                    <View style={styles.logsPanel}>
                      <View style={styles.logsPanelDivider} />

                      {isLoadingLogs ? (
                        <ActivityIndicator
                          size="small"
                          color={COLORS.primary}
                          style={{ marginVertical: 20 }}
                        />
                      ) : !logs || logs.length === 0 ? (
                        <View style={styles.noLogsContainer}>
                          <Ionicons
                            name="analytics-outline"
                            size={36}
                            color={COLORS.border}
                          />
                          <Text style={styles.noLogsText}>
                            No skin logs recorded yet.
                          </Text>
                        </View>
                      ) : (
                        <>
                          {/* Legend */}
                          <View style={styles.legend}>
                            {METRIC_CONFIG.map(({ key, label, color }) => (
                              <View key={key} style={styles.legendItem}>
                                <View
                                  style={[styles.legendDot, { backgroundColor: color }]}
                                />
                                <Text style={styles.legendLabel}>{label}</Text>
                              </View>
                            ))}
                          </View>

                          {/* Log entries */}
                          <View style={styles.logsListContainer}>
                            {logs.map((log) => (
                              <SkinLogCard key={log.id} log={log} />
                            ))}
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },

  // Page header
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  pageTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  pageSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },

  // Empty
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: "500",
    textAlign: "center",
  },

  // List
  list: { gap: SPACING.md },
  resultsCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },

  // Client card
  clientCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  clientHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: "700",
  },
  clientInfo: { flex: 1, minWidth: 0 },
  clientName: {
    fontSize: FONT_SIZE.md,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  clientEmail: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,139,167,0.1)",
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
    flexShrink: 0,
  },
  streakIcon: { fontSize: 12 },
  streakText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // Expanded panel
  logsPanel: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  logsPanelDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  noLogsContainer: {
    alignItems: "center",
    paddingVertical: 24,
    gap: SPACING.sm,
  },
  noLogsText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },

  // Legend
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },

  logsListContainer: { gap: SPACING.sm },

  // Individual log card
  logCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  logDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  logDate: {
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricsRow: { gap: 6 },

  // Metric bar
  metricWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  metricLabel: {
    width: 72,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  metricValue: {
    width: 28,
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
    textAlign: "right",
  },
});
