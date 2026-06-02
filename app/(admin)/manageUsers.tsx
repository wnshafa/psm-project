import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../src/constants/theme';
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

const METRIC_CONFIG = [
  { key: 'hydration' as const, label: 'Hydration', color: '#4ecdc4' },
  { key: 'oiliness' as const, label: 'Oiliness', color: '#ff6b6b' },
  { key: 'sensitivity' as const, label: 'Sensitivity', color: '#f7b731' },
  { key: 'brightness' as const, label: 'Brightness', color: '#a29bfe' },
];

const getClientName = (user: MergedUser) => user.fullName ?? user.name ?? 'Unnamed Client';

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
  const [users, setUsers] = useState<MergedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>(
    params.tab === 'progress' || params.tab === 'skin' ? params.tab : 'users'
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [routineLogsMap, setRoutineLogsMap] = useState<Record<string, RoutineLog[]>>({});
  const [skinPhotosMap, setSkinPhotosMap] = useState<Record<string, ClientSkinPhoto[]>>({});
  const [skinMetricsMap, setSkinMetricsMap] = useState<Record<string, SkinMetricLog[]>>({});
  const [loadingDetailsFor, setLoadingDetailsFor] = useState<string | null>(null);

  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ClientSkinPhoto | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    let usersMap: Record<string, any> = {};
    let clientsList: any[] = [];
    let usersReady = false;
    let clientsReady = false;

    const merge = () => {
      if (!usersReady || !clientsReady) return;

      const merged = clientsList
        .map((client) => {
          const profile = usersMap[client.id] ?? {};
          return {
            ...client,
            ...profile,
            id: client.id,
            fullName: profile.fullName ?? profile.name ?? client.fullName ?? client.name ?? 'Unnamed Client',
            email: profile.email ?? client.email ?? '',
            active: profile.active ?? client.active,
            streak: client.streak ?? profile.streak ?? 0,
            totalCompleted: client.totalCompleted ?? profile.totalCompleted ?? 0,
            dailyAdherence: client.dailyAdherence ?? profile.dailyAdherence ?? 0,
            skinType: client.skinType ?? profile.skinType,
            skinConcern: client.skinConcern ?? profile.skinConcern,
            age: client.age ?? profile.age,
            phoneNumber: client.phoneNumber ?? profile.phoneNumber,
          } as MergedUser;
        })
        .sort((a, b) => getClientName(a).localeCompare(getClientName(b)));

      setUsers(merged);
      setLoading(false);
    };

    const unsubUsers = onSnapshot(query(collection(db, 'users'), where('role', '!=', 'admin')), (snap) => {
      usersMap = {};
      snap.docs.forEach((d) => {
        usersMap[d.id] = d.data();
      });
      usersReady = true;
      merge();
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      clientsList = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }));
      clientsReady = true;
      merge();
    });

    return () => {
      unsubUsers();
      unsubClients();
    };
  }, []);

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

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    if (expandedId) loadClientDetails(expandedId, tab);
  };

  const handleToggleExpanded = (clientId: string) => {
    const nextId = expandedId === clientId ? null : clientId;
    setExpandedId(nextId);
    if (nextId) loadClientDetails(nextId);
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

  const renderUserDetails = (user: MergedUser) => (
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

  const renderProgressDetails = (user: MergedUser) => {
    const logs = routineLogsMap[user.id] ?? [];
    const photos = skinPhotosMap[user.id] ?? [];
    const isLoading = loadingDetailsFor === user.id;

    if (isLoading) return <ActivityIndicator size="small" color={COLORS.primary} style={styles.panelLoader} />;

    return (
      <>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{user.streak ?? 0}</Text>
            <Text style={styles.summaryLabel}>Day Streak</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{logs.length}</Text>
            <Text style={styles.summaryLabel}>Routine Logs</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{photos.length}</Text>
            <Text style={styles.summaryLabel}>Photos</Text>
          </View>
        </View>

        <Text style={styles.panelTitle}>Skin Progress Photos</Text>
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

        <Text style={styles.panelTitle}>Activity History</Text>
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

  const renderSkinDetails = (user: MergedUser) => {
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
    <SafeAreaView style={styles.screen}>
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
          <View style={styles.list}>
            {filtered.map((user) => {
              const isExpanded = expandedId === user.id;
              const name = getClientName(user);

              return (
                <View key={user.id} style={styles.card}>
                  <Pressable style={styles.cardHeader} onPress={() => handleToggleExpanded(user.id)}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.userSummary}>
                      <Text style={styles.userName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.userEmail} numberOfLines={1}>{user.email || 'No email'}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: user.active === false ? 'rgba(255,107,107,0.12)' : 'rgba(81,207,102,0.12)' }]}>
                      <Text style={[styles.statusText, { color: user.active === false ? '#ff6b6b' : '#51cf66' }]}>
                        {user.active === false ? 'Inactive' : 'Active'}
                      </Text>
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.details}>
                      <View style={styles.divider} />
                      {activeTab === 'users' && renderUserDetails(user)}
                      {activeTab === 'progress' && renderProgressDetails(user)}
                      {activeTab === 'skin' && renderSkinDetails(user)}
                    </View>
                  )}
                </View>
              );
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
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
  list: { gap: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(27,58,107,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  userSummary: { flex: 1, minWidth: 0 },
  userName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  userEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, flexShrink: 0 },
  statusText: { fontSize: 11, fontWeight: '700' },
  details: { paddingHorizontal: 14, paddingBottom: 14 },
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
  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
  feedbackModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  feedbackModal: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg },
  feedbackModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  feedbackModalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary },
  feedbackInput: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, height: 110, textAlignVertical: 'top', color: COLORS.textPrimary },
  saveFeedbackBtn: { backgroundColor: COLORS.primary, padding: 15, borderRadius: BORDER_RADIUS.md, marginTop: 20, alignItems: 'center' },
  saveFeedbackText: { color: COLORS.white, fontWeight: '700' },
});
