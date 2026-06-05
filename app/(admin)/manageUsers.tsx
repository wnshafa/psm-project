import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../src/constants/theme';
import { useClientsWithProfiles } from '../../src/hooks/useClientsWithProfiles';
import { SKIN_METRICS } from '../../src/constants/metrics';
import { db } from '../../src/lib/firebase';
import { RoutineLog, SkinPhoto, UserData } from '../../src/types';

type AdminTab = 'users' | 'progress' | 'skin';

type MergedUser = UserData & {
  active?: boolean;
};

type SkinMetricLog = {
  id: string;
  clientId: string;
  date?: Timestamp;
  hydration?: number;
  oiliness?: number;
  sensitivity?: number;
  brightness?: number;
};

type ClientSkinPhoto = SkinPhoto & {
  clientId?: string;
};

const TABS: { key: AdminTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'progress', label: 'Progress', icon: 'analytics-outline' },
  { key: 'skin', label: 'Skin Metrics', icon: 'pulse-outline' },
];

const METRIC_CONFIG = SKIN_METRICS;

const getClientName = (user: MergedUser) => user.fullName ?? user.name ?? 'Unnamed Client';

const formatPhone = (phone?: string | null) => {
  if (!phone) return '—';
  const cleaned = phone.replace(/[-\s]/g, '');
  // 011-XXXXXXXX (8 digits after prefix)
  if (/^(011)\d{8}$/.test(cleaned)) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  // 01X-XXXXXXX (7 digits after prefix)
  if (/^(01\d)\d{7}$/.test(cleaned)) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return phone;
};

const formatDate = (ts?: Timestamp | null, includeTime = false) => {
  if (!ts || typeof ts.toDate !== 'function') return 'N/A';
  return ts.toDate().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit' as const, minute: '2-digit' as const } : {}),
  });
};

function MetricBar({ value, color, label }: { value?: number; color: string; label: string }) {
  const clampedValue = Math.min(100, Math.max(0, value ?? 0));

  return (
    <View style={styles.metricWrapper}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${clampedValue}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.metricValue, { color }]}>{clampedValue}</Text>
    </View>
  );
}

export default function ManageUsers() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { clients: rawClients, loading } = useClientsWithProfiles();
  const users: MergedUser[] = rawClients.map(c => ({ ...c } as MergedUser));
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>(
    params.tab === 'progress' || params.tab === 'skin' ? params.tab : 'users'
  );
  const [routineLogsMap, setRoutineLogsMap] = useState<Record<string, RoutineLog[]>>({});
  const [skinPhotosMap, setSkinPhotosMap] = useState<Record<string, ClientSkinPhoto[]>>({});
  const [skinMetricsMap, setSkinMetricsMap] = useState<Record<string, SkinMetricLog[]>>({});
  const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(null);

  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ClientSkinPhoto | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [progressModalUser, setProgressModalUser] = useState<MergedUser | null>(null);

  useEffect(() => {
    if (params.tab === 'progress' || params.tab === 'skin' || params.tab === 'users') {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => getClientName(u).toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q));
  }, [search, users]);

  const loadClientDetails = async (clientId: string, tab: AdminTab = activeTab) => {
    if (tab === 'users') return;

    const hasProgress = routineLogsMap[clientId] && skinPhotosMap[clientId];
    const hasSkinMetrics = skinMetricsMap[clientId];
    if ((tab === 'progress' && hasProgress) || (tab === 'skin' && hasSkinMetrics)) return;

    setLoadingDetailsFor(clientId);
    try {
      if (tab === 'progress') {
        const [logsSnap, photosSnap] = await Promise.all([
          getDocs(query(collection(db, 'routineLogs'), where('clientId', '==', clientId), orderBy('logDate', 'desc'))),
          getDocs(query(collection(db, 'skinLogs'), where('clientId', '==', clientId), orderBy('date', 'desc'))),
        ]);

        setRoutineLogsMap((prev) => ({
          ...prev,
          [clientId]: logsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as RoutineLog[],
        }));
        setSkinPhotosMap((prev) => ({
          ...prev,
          [clientId]: photosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as ClientSkinPhoto[],
        }));
      }

      if (tab === 'skin') {
        const metricsSnap = await getDocs(query(collection(db, 'skinLogs'), where('clientId', '==', clientId), orderBy('date', 'desc')));
        setSkinMetricsMap((prev) => ({
          ...prev,
          [clientId]: metricsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as SkinMetricLog[],
        }));
      }
    } catch (error) {
      console.error('Failed to load client details:', error);
      if (tab === 'progress') {
        setRoutineLogsMap((prev) => ({ ...prev, [clientId]: [] }));
        setSkinPhotosMap((prev) => ({ ...prev, [clientId]: [] }));
      } else {
        setSkinMetricsMap((prev) => ({ ...prev, [clientId]: [] }));
      }
    } finally {
      setLoadingDetailsFor(null);
    }
  };

  // Data loads on-demand per row via loadClientDetails when a row is rendered in progress/skin tab

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
  };

  const handleDelete = (user: MergedUser) => {
    Alert.alert('Remove User', `Are you sure you want to remove ${getClientName(user)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', user.id));
            await deleteDoc(doc(db, 'clients', user.id));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleToggleActive = async (user: MergedUser) => {
    try {
      await updateDoc(doc(db, 'users', user.id), { active: !user.active });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedPhoto || !feedbackText.trim()) {
      Alert.alert('Error', 'Please enter some feedback.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const photoRef = doc(db, 'skinLogs', selectedPhoto.id);
      const feedback = feedbackText.trim();
      await updateDoc(photoRef, {
        consultantFeedback: feedback,
        feedbackDate: Timestamp.now(),
      });

      setSkinPhotosMap((prev) => ({
        ...prev,
        [selectedPhoto.clientId ?? selectedPhoto.userId]: (prev[selectedPhoto.clientId ?? selectedPhoto.userId] ?? []).map((photo) =>
          photo.id === selectedPhoto.id ? { ...photo, consultantFeedback: feedback, feedbackDate: Timestamp.now() } : photo
        ),
      }));

      Alert.alert('Success', 'Feedback saved successfully.');
      setFeedbackModalVisible(false);
      setFeedbackText('');
      setSelectedPhoto(null);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _renderUserDetails = (user: MergedUser) => (
    <>
      <View style={styles.detailGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Skin Type</Text>
          <Text style={styles.detailValue}>{user.skinType ?? 'N/A'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Age</Text>
          <Text style={styles.detailValue}>{user.age ?? 'N/A'}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Streak</Text>
          <Text style={styles.detailValue}>{user.streak ?? 0} days</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Completed</Text>
          <Text style={styles.detailValue}>{user.totalCompleted ?? 0} routines</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Adherence</Text>
          <Text style={styles.detailValue}>{user.dailyAdherence ?? 0}%</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Phone</Text>
          <Text style={styles.detailValue}>{user.phoneNumber ?? 'N/A'}</Text>
        </View>
      </View>

      {user.skinConcern && (
        <View style={styles.tagsRow}>
          {(Array.isArray(user.skinConcern) ? user.skinConcern : [user.skinConcern]).map((concern, index) => (
            <View key={`${concern}-${index}`} style={styles.tag}>
              <Text style={styles.tagText}>{concern}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={() => handleToggleActive(user)}>
          <Ionicons name={user.active === false ? 'checkmark-circle-outline' : 'ban-outline'} size={16} color={COLORS.textSecondary} />
          <Text style={styles.actionText}>{user.active === false ? 'Activate' : 'Deactivate'}</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(user)}>
          <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
          <Text style={[styles.actionText, { color: '#ff6b6b' }]}>Remove</Text>
        </Pressable>
      </View>
    </>
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _renderProgressDetails = (user: MergedUser) => {
    const logs = routineLogsMap[user.id] ?? [];
    const photos = skinPhotosMap[user.id] ?? [];
    const isLoading = loadingDetailsFor === user.id;

    if (isLoading) return <ActivityIndicator size="small" color={COLORS.primary} style={styles.panelLoader} />;

    // --- Weekly consistency (last 4 weeks, max 14 routines/week: 2/day x 7) ---
    const getISOWeekKey = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const yearStart = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    };

    const getMonthKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const now = new Date();

    // Build week buckets for last 4 weeks
    const weekBuckets: { label: string; key: string; count: number }[] = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const key = getISOWeekKey(d);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const label = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      return { label, key, count: 0 };
    }).reverse();

    // Build month buckets for last 4 months
    const monthBuckets: { label: string; key: string; count: number }[] = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return {
        label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        key: getMonthKey(d),
        count: 0,
      };
    }).reverse();

    logs.forEach((log) => {
      if (!log.logDate || typeof log.logDate.toDate !== 'function') return;
      const date = log.logDate.toDate();
      const wk = getISOWeekKey(date);
      const mo = getMonthKey(date);
      const wb = weekBuckets.find((b) => b.key === wk);
      if (wb) wb.count++;
      const mb = monthBuckets.find((b) => b.key === mo);
      if (mb) mb.count++;
    });

    const MAX_PER_WEEK = 14;
    const MAX_PER_MONTH = 60;

    // Trend: compare current week vs previous week
    const thisWeek = weekBuckets[3]?.count ?? 0;
    const lastWeek = weekBuckets[2]?.count ?? 0;
    const trendDiff = thisWeek - lastWeek;
    const trendIcon = trendDiff > 0 ? 'trending-up' : trendDiff < 0 ? 'trending-down' : 'remove';
    const trendColor = trendDiff > 0 ? '#51cf66' : trendDiff < 0 ? '#ff6b6b' : COLORS.textSecondary;
    const trendLabel = trendDiff > 0 ? `+${trendDiff} vs last week` : trendDiff < 0 ? `${trendDiff} vs last week` : 'Same as last week';

    return (
      <>
        {/* Summary row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{user.streak ?? 0}</Text>
            <Text style={styles.summaryLabel}>Day Streak</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{logs.length}</Text>
            <Text style={styles.summaryLabel}>Total Logs</Text>
          </View>
          <View style={[styles.summaryItem, { borderColor: trendColor, borderWidth: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name={trendIcon as any} size={16} color={trendColor} />
              <Text style={[styles.summaryValue, { color: trendColor }]}>{thisWeek}</Text>
            </View>
            <Text style={styles.summaryLabel}>This Week</Text>
          </View>
        </View>

        {/* Trend label */}
        <View style={styles.trendRow}>
          <Ionicons name={trendIcon as any} size={13} color={trendColor} />
          <Text style={[styles.trendLabel, { color: trendColor }]}>{trendLabel}</Text>
        </View>

        {/* Weekly consistency */}
        <Text style={styles.panelTitle}>Weekly Consistency</Text>
        <View style={styles.consistencyGrid}>
          {weekBuckets.map((w, i) => {
            const pct = Math.min(100, Math.round((w.count / MAX_PER_WEEK) * 100));
            const isCurrentWeek = i === weekBuckets.length - 1;
            return (
              <View key={w.key} style={styles.consistencyItem}>
                <Text style={[styles.consistencyPct, isCurrentWeek && { color: COLORS.primary }]}>{pct}%</Text>
                <View style={styles.consistencyBarTrack}>
                  <View style={[styles.consistencyBarFill, { height: `${pct}%` as any, backgroundColor: isCurrentWeek ? COLORS.primary : '#a29bfe' }]} />
                </View>
                <Text style={styles.consistencyWeekLabel}>{w.label}</Text>
                <Text style={styles.consistencyCount}>{w.count}/{MAX_PER_WEEK}</Text>
              </View>
            );
          })}
        </View>

        {/* Monthly consistency */}
        <Text style={[styles.panelTitle, { marginTop: 14 }]}>Monthly Consistency</Text>
        <View style={styles.monthGrid}>
          {monthBuckets.map((m, i) => {
            const pct = Math.min(100, Math.round((m.count / MAX_PER_MONTH) * 100));
            const isCurrentMonth = i === monthBuckets.length - 1;
            return (
              <View key={m.key} style={[styles.monthCard, isCurrentMonth && styles.monthCardActive]}>
                <Text style={[styles.monthLabel, isCurrentMonth && { color: COLORS.primary }]}>{m.label}</Text>
                <Text style={[styles.monthPct, isCurrentMonth && { color: COLORS.primary }]}>{pct}%</Text>
                <View style={styles.monthBarTrack}>
                  <View style={[styles.monthBarFill, { width: `${pct}%` as any, backgroundColor: isCurrentMonth ? COLORS.primary : '#4ecdc4' }]} />
                </View>
                <Text style={styles.monthCount}>{m.count} routines</Text>
              </View>
            );
          })}
        </View>

        {/* Skin progress photos */}
        <Text style={[styles.panelTitle, { marginTop: 14 }]}>Skin Progress Photos</Text>
        {photos.length === 0 ? (
          <Text style={styles.emptyInline}>No skin progress photos found.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoCard}>
                <Image source={{ uri: photo.imageUrl }} style={styles.skinImage} />
                <Text style={styles.photoDate}>{formatDate(photo.date)}</Text>
                {photo.consultantFeedback && (
                  <View style={styles.feedbackPreview}>
                    <Text style={styles.feedbackLabel}>Consultant Note</Text>
                    <Text style={styles.feedbackText} numberOfLines={3}>
                      {photo.consultantFeedback}
                    </Text>
                  </View>
                )}
                <Pressable
                  style={styles.feedbackBtn}
                  onPress={() => {
                    setSelectedPhoto(photo);
                    setFeedbackText(photo.consultantFeedback || '');
                    setFeedbackModalVisible(true);
                  }}
                >
                  <Text style={styles.feedbackBtnText}>{photo.consultantFeedback ? 'Edit Feedback' : 'Add Feedback'}</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Activity history */}
        <Text style={[styles.panelTitle, { marginTop: 14 }]}>Activity History</Text>
        {logs.length === 0 ? (
          <Text style={styles.emptyInline}>No routine logs recorded.</Text>
        ) : (
          <View style={styles.logsList}>
            {logs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logIndicator} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.logDate}>{formatDate(log.logDate, true)}</Text>
                  <Text style={styles.logStatus}>{log.status ? `Routine ${log.status}` : log.type ?? 'Routine log'}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _renderSkinDetails = (user: MergedUser) => {
    const logs = skinMetricsMap[user.id] ?? [];
    const isLoading = loadingDetailsFor === user.id;

    if (isLoading) return <ActivityIndicator size="small" color={COLORS.primary} style={styles.panelLoader} />;

    if (logs.length === 0) {
      return (
        <View style={styles.emptyPanel}>
          <Ionicons name="analytics-outline" size={34} color={COLORS.border} />
          <Text style={styles.emptyInline}>No skin metric history recorded yet.</Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.legend}>
          {METRIC_CONFIG.map(({ key, label, color }) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.metricLogs}>
          {logs.map((log) => (
            <View key={log.id} style={styles.metricCard}>
              <View style={styles.metricDateRow}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.metricDate}>{formatDate(log.date)}</Text>
              </View>
              {METRIC_CONFIG.map(({ key, label, color }) => (
                <MetricBar key={key} value={log[key]} color={color} label={label} />
              ))}
            </View>
          ))}
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Client Management</Text>
            <Text style={styles.pageSubtitle}>Manage profiles, progress feedback, and skin analysis history.</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable key={tab.key} style={[styles.tabBtn, isActive && styles.tabBtnActive]} onPress={() => handleTabChange(tab.key)}>
                <Ionicons name={tab.icon} size={17} color={isActive ? COLORS.white : COLORS.textSecondary} />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </Pressable>
          )}
        </View>

        <Text style={styles.countText}>{filtered.length} client{filtered.length !== 1 ? 's' : ''}</Text>

        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>No clients found</Text>
          </View>
        ) : (
          <View style={styles.tableWrapper}>
            {/* Table header — columns change per tab */}
            {activeTab === 'users' && (
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Client</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Skin Type</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Age</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Streak</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Adherence</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Phone</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Status</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Actions</Text>
              </View>
            )}
            {activeTab === 'progress' && (
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Client</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Streak</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Total Logs</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>This Week</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Last Week</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>This Month</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Trend</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Detail</Text>
              </View>
            )}
            {activeTab === 'skin' && (
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Client</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Hydration</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Oiliness</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Sensitivity</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Brightness</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Last Entry</Text>
              </View>
            )}

            {filtered.map((user, index) => {
              const name = getClientName(user);
              const isEven = index % 2 === 0;

              if (activeTab === 'users') {
                return (
                  <View key={user.id} style={[styles.tableRow, isEven && styles.tableRowEven]}>
                    <View style={[styles.tableCell, { flex: 2 }]}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.userName} numberOfLines={1}>{name}</Text>
                        <Text style={styles.userEmail} numberOfLines={1}>{user.email || 'No email'}</Text>
                      </View>
                    </View>
                    <Text style={[styles.tableCellText, { flex: 1 }]} numberOfLines={1}>{user.skinType ?? '—'}</Text>
                    <Text style={[styles.tableCellText, { flex: 0.6 }]}>{user.age ?? '—'}</Text>
                    <Text style={[styles.tableCellText, { flex: 0.8 }]}>{user.streak ?? 0}d</Text>
                    <Text style={[styles.tableCellText, { flex: 0.9 }]}>{user.dailyAdherence ?? 0}%</Text>
                    <Text style={[styles.tableCellText, { flex: 1 }]} numberOfLines={1}>{formatPhone(user.phoneNumber)}</Text>
                    <View style={{ flex: 0.8 }}>
                      <View style={[styles.statusPill, { backgroundColor: user.active === false ? 'rgba(255,107,107,0.12)' : 'rgba(81,207,102,0.12)' }]}>
                        <Text style={[styles.statusText, { color: user.active === false ? '#ff6b6b' : '#51cf66' }]}>
                          {user.active === false ? 'Inactive' : 'Active'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.tableCell, { flex: 0.8, gap: 6 }]}>
                      <Pressable style={styles.actionIconBtn} onPress={() => handleToggleActive(user)}>
                        <Ionicons name={user.active === false ? 'checkmark-circle-outline' : 'ban-outline'} size={16} color={COLORS.textSecondary} />
                      </Pressable>
                      <Pressable style={[styles.actionIconBtn, styles.actionIconBtnDanger]} onPress={() => handleDelete(user)}>
                        <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                      </Pressable>
                    </View>
                  </View>
                );
              }

              if (activeTab === 'progress') {
                if (!routineLogsMap[user.id] && !skinPhotosMap[user.id]) loadClientDetails(user.id, 'progress');
                const logs = routineLogsMap[user.id];
                const allLogs = logs ?? [];

                const getISOWeekKey = (date: Date) => {
                  const d = new Date(date);
                  d.setHours(0, 0, 0, 0);
                  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
                  const yearStart = new Date(d.getFullYear(), 0, 1);
                  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
                  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
                };
                const getMonthKey = (date: Date) =>
                  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                const now = new Date();
                const thisWeekKey = getISOWeekKey(now);
                const lastWeekDate = new Date(now); lastWeekDate.setDate(now.getDate() - 7);
                const lastWeekKey = getISOWeekKey(lastWeekDate);
                const thisMonthKey = getMonthKey(now);

                let thisWeekCount = 0, lastWeekCount = 0, thisMonthCount = 0;
                allLogs.forEach((log) => {
                  if (!log.logDate || typeof log.logDate.toDate !== 'function') return;
                  const d = log.logDate.toDate();
                  if (getISOWeekKey(d) === thisWeekKey) thisWeekCount++;
                  if (getISOWeekKey(d) === lastWeekKey) lastWeekCount++;
                  if (getMonthKey(d) === thisMonthKey) thisMonthCount++;
                });

                const trendDiff = thisWeekCount - lastWeekCount;
                const trendIcon = trendDiff > 0 ? 'trending-up' : trendDiff < 0 ? 'trending-down' : 'remove';
                const trendColor = trendDiff > 0 ? '#51cf66' : trendDiff < 0 ? '#ff6b6b' : COLORS.textSecondary;

                return (
                  <View key={user.id} style={[styles.tableRow, isEven && styles.tableRowEven]}>
                    <View style={[styles.tableCell, { flex: 2 }]}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.userName} numberOfLines={1}>{name}</Text>
                        <Text style={styles.userEmail} numberOfLines={1}>{user.email || 'No email'}</Text>
                      </View>
                    </View>
                    <Text style={[styles.tableCellText, { flex: 0.8 }]}>{user.streak ?? 0}d</Text>
                    {!logs ? (
                      <ActivityIndicator size="small" color={COLORS.primary} style={{ flex: 4 }} />
                    ) : (
                      <>
                        <Text style={[styles.tableCellText, { flex: 0.8 }]}>{allLogs.length}</Text>
                        <Text style={[styles.tableCellText, { flex: 1 }]}>{thisWeekCount}/14</Text>
                        <Text style={[styles.tableCellText, { flex: 1 }]}>{lastWeekCount}/14</Text>
                        <Text style={[styles.tableCellText, { flex: 1 }]}>{thisMonthCount}/60</Text>
                        <View style={[styles.tableCell, { flex: 0.8 }]}>
                          <Ionicons name={trendIcon as any} size={15} color={trendColor} />
                          <Text style={[styles.tableCellText, { color: trendColor, fontSize: 11 }]}>
                            {trendDiff > 0 ? `+${trendDiff}` : trendDiff === 0 ? '—' : `${trendDiff}`}
                          </Text>
                        </View>
                        <View style={{ flex: 0.8 }}>
                          <Pressable style={styles.viewBtn} onPress={() => setProgressModalUser(user)}>
                            <Ionicons name="eye-outline" size={13} color={COLORS.primary} />
                            <Text style={styles.viewBtnText}>View</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                );
              }

              if (activeTab === 'skin') {
                if (!skinMetricsMap[user.id]) loadClientDetails(user.id, 'skin');
                const metrics = skinMetricsMap[user.id];
                const latest = metrics?.[0];
                return (
                  <View key={user.id} style={[styles.tableRow, isEven && styles.tableRowEven]}>
                    <View style={[styles.tableCell, { flex: 2 }]}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.userName} numberOfLines={1}>{name}</Text>
                        <Text style={styles.userEmail} numberOfLines={1}>{user.email || 'No email'}</Text>
                      </View>
                    </View>
                    {!metrics ? (
                      <ActivityIndicator size="small" color={COLORS.primary} style={{ flex: 5 }} />
                    ) : (
                      <>
                        <Text style={[styles.tableCellText, { flex: 1, color: '#4ecdc4' }]}>{latest?.hydration ?? '—'}</Text>
                        <Text style={[styles.tableCellText, { flex: 1, color: '#ff6b6b' }]}>{latest?.oiliness ?? '—'}</Text>
                        <Text style={[styles.tableCellText, { flex: 1, color: '#f7b731' }]}>{latest?.sensitivity ?? '—'}</Text>
                        <Text style={[styles.tableCellText, { flex: 1, color: '#a29bfe' }]}>{latest?.brightness ?? '—'}</Text>
                        <Text style={[styles.tableCellText, { flex: 1 }]}>{formatDate(latest?.date)}</Text>
                      </>
                    )}
                  </View>
                );
              }

              return null;
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={feedbackModalVisible} animationType="fade" transparent onRequestClose={() => setFeedbackModalVisible(false)}>
        <View style={styles.feedbackModalOverlay}>
          <View style={styles.feedbackModal}>
            <View style={styles.feedbackModalHeader}>
              <Text style={styles.feedbackModalTitle}>Consultant Feedback</Text>
              <Pressable onPress={() => setFeedbackModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <TextInput
              style={styles.feedbackInput}
              multiline
              placeholder="Write your advice or observations here..."
              placeholderTextColor={COLORS.textSecondary}
              value={feedbackText}
              onChangeText={setFeedbackText}
            />

            <Pressable style={styles.saveFeedbackBtn} onPress={handleSubmitFeedback} disabled={submittingFeedback}>
              {submittingFeedback ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveFeedbackText}>Save Feedback</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Progress Detail Modal */}
      <Modal
        visible={!!progressModalUser}
        animationType="slide"
        transparent
        onRequestClose={() => setProgressModalUser(null)}
      >
        <View style={styles.progressModalOverlay}>
          <View style={styles.progressModalContainer}>
            {/* Header */}
            <View style={styles.progressModalHeader}>
              <View style={styles.tableCell}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {progressModalUser ? getClientName(progressModalUser).charAt(0).toUpperCase() : ''}
                  </Text>
                </View>
                <View>
                  <Text style={styles.progressModalName}>{progressModalUser ? getClientName(progressModalUser) : ''}</Text>
                  <Text style={styles.userEmail}>{progressModalUser?.email || ''}</Text>
                </View>
              </View>
              <Pressable onPress={() => setProgressModalUser(null)} style={styles.progressModalClose}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.progressModalScroll} showsVerticalScrollIndicator={false}>
              {progressModalUser && (() => {
                const user = progressModalUser;
                const logs = routineLogsMap[user.id] ?? [];
                const photos = skinPhotosMap[user.id] ?? [];

                const getISOWeekKey = (date: Date) => {
                  const d = new Date(date);
                  d.setHours(0, 0, 0, 0);
                  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
                  const yearStart = new Date(d.getFullYear(), 0, 1);
                  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
                  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
                };
                const getMonthKey = (date: Date) =>
                  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                const now = new Date();
                const weekBuckets: { label: string; key: string; count: number }[] = Array.from({ length: 4 }, (_, i) => {
                  const d = new Date(now);
                  d.setDate(d.getDate() - i * 7);
                  const key = getISOWeekKey(d);
                  const weekStart = new Date(d);
                  weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
                  return { label: weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), key, count: 0 };
                }).reverse();

                const monthBuckets: { label: string; key: string; count: number }[] = Array.from({ length: 4 }, (_, i) => {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  return { label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), key: getMonthKey(d), count: 0 };
                }).reverse();

                logs.forEach((log) => {
                  if (!log.logDate || typeof log.logDate.toDate !== 'function') return;
                  const date = log.logDate.toDate();
                  const wb = weekBuckets.find((b) => b.key === getISOWeekKey(date));
                  if (wb) wb.count++;
                  const mb = monthBuckets.find((b) => b.key === getMonthKey(date));
                  if (mb) mb.count++;
                });

                const MAX_PER_WEEK = 14;
                const MAX_PER_MONTH = 60;
                const thisWeek = weekBuckets[3]?.count ?? 0;
                const lastWeek = weekBuckets[2]?.count ?? 0;
                const trendDiff = thisWeek - lastWeek;
                const trendIcon = trendDiff > 0 ? 'trending-up' : trendDiff < 0 ? 'trending-down' : 'remove';
                const trendColor = trendDiff > 0 ? '#51cf66' : trendDiff < 0 ? '#ff6b6b' : COLORS.textSecondary;
                const trendLabel = trendDiff > 0 ? `+${trendDiff} vs last week` : trendDiff < 0 ? `${trendDiff} vs last week` : 'Same as last week';

                return (
                  <>
                    {/* Summary cards */}
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{user.streak ?? 0}</Text>
                        <Text style={styles.summaryLabel}>Day Streak</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{logs.length}</Text>
                        <Text style={styles.summaryLabel}>Total Logs</Text>
                      </View>
                      <View style={[styles.summaryItem, { borderColor: trendColor, borderWidth: 1 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name={trendIcon as any} size={16} color={trendColor} />
                          <Text style={[styles.summaryValue, { color: trendColor }]}>{thisWeek}</Text>
                        </View>
                        <Text style={styles.summaryLabel}>This Week</Text>
                      </View>
                    </View>

                    {/* Trend */}
                    <View style={styles.trendRow}>
                      <Ionicons name={trendIcon as any} size={13} color={trendColor} />
                      <Text style={[styles.trendLabel, { color: trendColor }]}>{trendLabel}</Text>
                    </View>

                    {/* Weekly chart */}
                    <Text style={styles.panelTitle}>Weekly Consistency</Text>
                    <View style={styles.consistencyGrid}>
                      {weekBuckets.map((w, i) => {
                        const pct = Math.min(100, Math.round((w.count / MAX_PER_WEEK) * 100));
                        const isCurrent = i === weekBuckets.length - 1;
                        return (
                          <View key={w.key} style={styles.consistencyItem}>
                            <Text style={[styles.consistencyPct, isCurrent && { color: COLORS.primary }]}>{pct}%</Text>
                            <View style={styles.consistencyBarTrack}>
                              <View style={[styles.consistencyBarFill, { height: `${pct}%` as any, backgroundColor: isCurrent ? COLORS.primary : '#a29bfe' }]} />
                            </View>
                            <Text style={styles.consistencyWeekLabel}>{w.label}</Text>
                            <Text style={styles.consistencyCount}>{w.count}/{MAX_PER_WEEK}</Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Monthly chart */}
                    <Text style={[styles.panelTitle, { marginTop: 14 }]}>Monthly Consistency</Text>
                    <View style={styles.monthGrid}>
                      {monthBuckets.map((m, i) => {
                        const pct = Math.min(100, Math.round((m.count / MAX_PER_MONTH) * 100));
                        const isCurrent = i === monthBuckets.length - 1;
                        return (
                          <View key={m.key} style={[styles.monthCard, isCurrent && styles.monthCardActive]}>
                            <Text style={[styles.monthLabel, isCurrent && { color: COLORS.primary }]}>{m.label}</Text>
                            <Text style={[styles.monthPct, isCurrent && { color: COLORS.primary }]}>{pct}%</Text>
                            <View style={styles.monthBarTrack}>
                              <View style={[styles.monthBarFill, { width: `${pct}%` as any, backgroundColor: isCurrent ? COLORS.primary : '#4ecdc4' }]} />
                            </View>
                            <Text style={styles.monthCount}>{m.count} routines</Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Skin progress photos */}
                    <Text style={[styles.panelTitle, { marginTop: 14 }]}>Skin Progress Photos</Text>
                    {photos.length === 0 ? (
                      <Text style={styles.emptyInline}>No skin progress photos found.</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                        {photos.map((photo) => (
                          <View key={photo.id} style={styles.photoCard}>
                            <Image source={{ uri: photo.imageUrl }} style={styles.skinImage} />
                            <Text style={styles.photoDate}>{formatDate(photo.date)}</Text>
                            {photo.consultantFeedback && (
                              <View style={styles.feedbackPreview}>
                                <Text style={styles.feedbackLabel}>Consultant Note</Text>
                                <Text style={styles.feedbackText} numberOfLines={3}>{photo.consultantFeedback}</Text>
                              </View>
                            )}
                            <Pressable
                              style={styles.feedbackBtn}
                              onPress={() => {
                                setSelectedPhoto(photo);
                                setFeedbackText(photo.consultantFeedback || '');
                                setFeedbackModalVisible(true);
                              }}
                            >
                              <Text style={styles.feedbackBtnText}>{photo.consultantFeedback ? 'Edit Feedback' : 'Add Feedback'}</Text>
                            </Pressable>
                          </View>
                        ))}
                      </ScrollView>
                    )}

                    {/* Activity history */}
                    <Text style={[styles.panelTitle, { marginTop: 14 }]}>Activity History</Text>
                    {logs.length === 0 ? (
                      <Text style={styles.emptyInline}>No routine logs recorded.</Text>
                    ) : (
                      <View style={styles.logsList}>
                        {logs.map((log) => (
                          <View key={log.id} style={styles.logRow}>
                            <View style={styles.logIndicator} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.logDate}>{formatDate(log.logDate, true)}</Text>
                              <Text style={styles.logStatus}>{log.status ? `Routine ${log.status}` : log.type ?? 'Routine log'}</Text>
                            </View>
                            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  pageSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: 4, gap: 4 },
  tabBtn: { flex: 1, minHeight: 42, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: COLORS.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, paddingVertical: 0 },
  countText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableWrapper: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableHeaderCell: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableRowEven: { backgroundColor: 'rgba(247,249,252,0.6)' },
  tableCell: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 6 },
  tableCellText: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  actionIconBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  actionIconBtnDanger: { borderColor: 'rgba(255,107,107,0.3)', backgroundColor: 'rgba(255,107,107,0.06)' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(27,58,107,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  userName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  userEmail: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: '700' },
  details: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 14 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  detailItem: { width: '30%', minWidth: 110 },
  detailLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  detailValue: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag: { backgroundColor: COLORS.background, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  deleteBtn: { borderColor: 'rgba(255,107,107,0.3)', backgroundColor: 'rgba(255,107,107,0.06)' },
  actionText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryItem: { flex: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  summaryValue: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  panelTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  panelLoader: { marginVertical: 24 },
  emptyInline: { color: COLORS.textSecondary, textAlign: 'center', fontSize: 13, fontWeight: '500', paddingVertical: 14 },
  emptyPanel: { alignItems: 'center', gap: 6, paddingVertical: 22 },
  photoStrip: { marginBottom: 14 },
  photoCard: { width: 150, marginRight: 12, alignItems: 'center' },
  skinImage: { width: 140, height: 180, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  photoDate: { fontSize: 10, color: COLORS.textSecondary, marginTop: 6, fontWeight: '700' },
  feedbackPreview: { marginTop: 8, padding: 8, backgroundColor: COLORS.background, borderRadius: 8, width: 140 },
  feedbackLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 2, textTransform: 'uppercase' },
  feedbackText: { fontSize: 11, color: COLORS.textPrimary, fontStyle: 'italic' },
  feedbackBtn: { marginTop: 8, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: 'rgba(27,58,107,0.12)', borderRadius: 8, width: 140 },
  feedbackBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  logsList: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  logRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.md },
  logIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  logDate: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: '600' },
  logStatus: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textTransform: 'capitalize' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600' },
  metricLogs: { gap: SPACING.sm },
  metricCard: { backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm + 2, gap: SPACING.sm },
  metricDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricDate: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  metricWrapper: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  metricLabel: { width: 72, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600' },
  barTrack: { flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  metricValue: { width: 28, fontSize: FONT_SIZE.xs, fontWeight: '700', textAlign: 'right' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  trendLabel: { fontSize: 11, fontWeight: '700' },
  consistencyGrid: { flexDirection: 'row', gap: 8, marginBottom: 4, height: 120, alignItems: 'flex-end' },
  consistencyItem: { flex: 1, alignItems: 'center', gap: 3 },
  consistencyPct: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary },
  consistencyBarTrack: { flex: 1, width: '100%', maxWidth: 32, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  consistencyBarFill: { width: '100%', borderRadius: 4 },
  consistencyWeekLabel: { fontSize: 9, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  consistencyCount: { fontSize: 9, color: COLORS.textSecondary, textAlign: 'center' },
  monthGrid: { gap: 6 },
  monthCard: { backgroundColor: COLORS.background, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  monthCardActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(255,139,167,0.06)' },
  monthLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  monthPct: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  monthBarTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  monthBarFill: { height: '100%', borderRadius: 3 },
  monthCount: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: 'rgba(255,139,167,0.08)', alignSelf: 'flex-start' },
  viewBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  progressModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  progressModalContainer: { backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: 30 },
  progressModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  progressModalName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  progressModalClose: { padding: 4 },
  progressModalScroll: { padding: 18, gap: 4 },
  feedbackModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  feedbackModal: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg },
  feedbackModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  feedbackModalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary },
  feedbackInput: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, height: 110, textAlignVertical: 'top', color: COLORS.textPrimary },
  saveFeedbackBtn: { backgroundColor: COLORS.primary, padding: 15, borderRadius: BORDER_RADIUS.md, marginTop: 20, alignItems: 'center' },
  saveFeedbackText: { color: COLORS.white, fontWeight: '700' },
});
