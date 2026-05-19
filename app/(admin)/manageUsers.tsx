import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS } from '../../src/constants/theme';
import { db } from '../../src/lib/firebase';
import { UserData } from '../../src/types';

type MergedUser = UserData & {
  active?: boolean;
  streak?: number;
  totalCompleted?: number;
  dailyAdherence?: number;
};

export default function ManageUsers() {
  const [users, setUsers] = useState<MergedUser[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const usersMap: Record<string, any> = {};
    let clientsList: any[] = [];
    let usersReady = false;
    let clientsReady = false;

    const merge = () => {
      if (!usersReady || !clientsReady) return;
      const merged = clientsList.map(client => ({
        ...client,
        ...(usersMap[client.id] ?? {}),
        id: client.id,
      }));
      setUsers(merged);
      setLoading(false);
    };

    // Fetch users for email/role
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('role', '!=', 'admin')),
      (snap) => {
        snap.docs.forEach(d => { usersMap[d.id] = d.data(); });
        usersReady = true;
        merge();
      }
    );

    // Fetch clients as primary source
    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      clientsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      clientsReady = true;
      merge();
    });

    return () => { unsubUsers(); unsubClients(); };
  }, []);

  const filtered = users.filter(u =>
    (u.fullName ?? u.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (user: UserData) => {
    Alert.alert(
      'Remove User',
      `Are you sure you want to remove ${user.fullName ?? user.name ?? 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.id));
              await deleteDoc(doc(db, 'clients', user.id));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (user: UserData & { active?: boolean }) => {
    try {
      await updateDoc(doc(db, 'users', user.id), { active: !user.active });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>

      {/* Search */}
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
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Count */}
      <Text style={styles.countText}>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</Text>

      {/* User list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={COLORS.border} />
          <Text style={styles.emptyText}>No users found</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((user) => {
            const name = user.fullName ?? user.name ?? 'Unknown';
            const isExpanded = expandedId === user.id;
            const client = clientsMap[user.id] ?? {};
            const u: MergedUser = {
              ...user,
              streak: client.streak ?? user.streak ?? 0,
              totalCompleted: client.totalCompleted ?? user.totalCompleted ?? 0,
              dailyAdherence: client.dailyAdherence ?? user.dailyAdherence ?? 0,
              skinType: client.skinType ?? user.skinType,
              skinConcern: client.skinConcern ?? user.skinConcern,
              age: client.age ?? user.age,
              phoneNumber: client.phoneNumber ?? user.phoneNumber,
            };

            return (
              <View key={user.id} style={styles.card}>
                {/* Header row */}
                <Pressable style={styles.cardHeader} onPress={() => setExpandedId(isExpanded ? null : user.id)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{name}</Text>
                    <Text style={styles.userEmail}>{user.email ?? '—'}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: u.active === false ? 'rgba(255,107,107,0.12)' : 'rgba(81,207,102,0.12)' }]}>
                    <Text style={[styles.statusText, { color: u.active === false ? '#ff6b6b' : '#51cf66' }]}>
                      {u.active === false ? 'Inactive' : 'Active'}
                    </Text>
                  </View>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} style={{ marginLeft: 8 }} />
                </Pressable>

                {/* Expanded details */}
                {isExpanded && (
                  <View style={styles.details}>
                    <View style={styles.divider} />

                    <View style={styles.detailGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Skin Type</Text>
                        <Text style={styles.detailValue}>{user.skinType ?? '—'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Age</Text>
                        <Text style={styles.detailValue}>{user.age ?? '—'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Streak</Text>
                        <Text style={styles.detailValue}>🔥 {user.streak ?? 0} days</Text>
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
                        <Text style={styles.detailValue}>{user.phoneNumber ?? '—'}</Text>
                      </View>
                    </View>

                    {/* Skin concerns */}
                    {user.skinConcern && (
                      <View style={styles.tagsRow}>
                        {(Array.isArray(user.skinConcern) ? user.skinConcern : [user.skinConcern]).map((c, i) => (
                          <View key={i} style={styles.tag}>
                            <Text style={styles.tagText}>{c}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Actions */}
                    <View style={styles.actions}>
                      <Pressable style={styles.actionBtn} onPress={() => handleToggleActive(u)}>
                        <Ionicons name={u.active === false ? 'checkmark-circle-outline' : 'ban-outline'} size={16} color={COLORS.textSecondary} />
                        <Text style={styles.actionText}>{u.active === false ? 'Activate' : 'Deactivate'}</Text>
                      </Pressable>
                      <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(user)}>
                        <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                        <Text style={[styles.actionText, { color: '#ff6b6b' }]}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  countText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  list: { gap: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,139,167,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  userName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  userEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700' },

  details: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 14 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  detailItem: { width: '30%' },
  detailLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  detailValue: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag: { backgroundColor: COLORS.inputBackground, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border },
  deleteBtn: { borderColor: 'rgba(255,107,107,0.3)', backgroundColor: 'rgba(255,107,107,0.06)' },
  actionText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
