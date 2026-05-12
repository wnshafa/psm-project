import { Ionicons } from "@expo/vector-icons";
import { router } from 'expo-router';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../src/constants/theme';
import { auth, db } from '../src/lib/firebase';
import { getAllProducts } from '../src/services/productService';
import { Product, SkinProfile, Stats } from '../src/types';
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Types ───────────────────────────────────────────────────────────────────



// ─── Skin Analysis Bar Chart (no external lib needed) ────────────────────────

const SKIN_METRICS = [
  { label: 'Hydration',    value: 72, color: '#4ecdc4' },
  { label: 'Oiliness',     value: 45, color: '#ff6b6b' },
  { label: 'Sensitivity',  value: 60, color: '#f7b731' },
  { label: 'Brightness',   value: 80, color: '#a29bfe' },
];

function SkinAnalysisChart() {
  const barMaxWidth = SCREEN_WIDTH - 80; // left label + padding

  return (
    <View style={chartStyles.container}>
      {SKIN_METRICS.map((metric) => (
        <View key={metric.label} style={chartStyles.row}>
          <Text style={chartStyles.label}>{metric.label}</Text>
          <View style={chartStyles.trackBackground}>
            <View
              style={[
                chartStyles.trackFill,
                {
                  width: (metric.value / 100) * (barMaxWidth - 60),
                  backgroundColor: metric.color,
                },
              ]}
            />
          </View>
          <Text style={chartStyles.value}>{metric.value}%</Text>
        </View>
      ))}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { gap: 10, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 80, fontSize: 12, color: '#666' },
  trackBackground: {
    flex: 1,
    height: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: 5 },
  value: { width: 36, fontSize: 12, color: '#333', textAlign: 'right' },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalCompleted: 0, streak: 0, lastRoutine: 'Never' });
  const [pendingReminders, setPendingReminders] = useState<any[]>([]);
  const [skinProfile, setSkinProfile] = useState<SkinProfile>({ skinType: '', skinConcern: '' });
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState<{ message: string; categories: string[] }>({
    message: '',
    categories: [],
  });
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);

  // ─── Toggle Save ─────────────────────────────────────────────────────────
  const toggleSave = (productId: string) => {
    setSavedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  // ─── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 1. Fetch products
    const fetchProducts = async () => {
      const data = await getAllProducts();
      setProducts(data);
    };
    fetchProducts();

    // 2. Fetch user profile (skin type + concern)
    // 2. Fetch user profile (skin type + concern)
    const unsubUser = onSnapshot(doc(db, 'clients', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStats({
          streak: data.streak || 0,
          totalCompleted: data.totalCompleted || 0,
          lastRoutine: data.lastRoutine || 'Never',
        });
        setSkinProfile({
          skinType: data.skinType || '', // Changed from 'normal'
          skinConcern: data.skinConcern || '', // Changed from 'medium'
        });
      }
    });

    // 3. Fetch Active Routines (kept for future use)
    const routineQuery = query(
      collection(db, 'routines'),
      where('clientId', '==', user.uid),
      limit(2)
    );
    const unsubRoutines = onSnapshot(routineQuery, () => {});

    // 4. Fetch Pending Reminders
    const reminderQuery = query(
      collection(db, 'reminder'),
      where('clientID', '==', `/clients/${user.uid}`),
      where('status', '==', 'unread'),
      limit(2)
    );
    const unsubReminders = onSnapshot(reminderQuery, (snap) => {
      setPendingReminders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubRoutines();
      unsubReminders();
    };
  }, []);

  useEffect(() => {

    if (!skinProfile.skinType || products.length === 0) {
        setRecommendedProducts([]);
        return;
    }

    // Convert user attributes to lowercase arrays for safe matching
    const userTypes = Array.isArray(skinProfile.skinType)
      ? skinProfile.skinType.map(t => t.toLowerCase())
      : [skinProfile.skinType.toLowerCase()];

    const userConcerns = Array.isArray(skinProfile.skinConcern)
      ? skinProfile.skinConcern.map(c => c.toLowerCase())
      : [skinProfile.skinConcern.toLowerCase()];

    // Filter products (Same logic as productsPage.tsx)
    const filtered = products.filter((p) => {
      if (!p.skinType || !p.skinConcern) return false;

      const productSkinTypes = Array.isArray(p.skinType) ? p.skinType : [p.skinType];
      const productConcerns = Array.isArray(p.skinConcern) ? p.skinConcern : [p.skinConcern];

      // Safe match Skin Type
      const matchSkinType = productSkinTypes.some((type) =>
        type && userTypes.includes(type.toLowerCase())
      );

      // Safe match Concern
      const matchConcern = productConcerns.some((c) =>
        c && userConcerns.includes(c.toLowerCase())
      );

      return matchSkinType && matchConcern;
    });

    setRecommendedProducts(filtered);

    // Update the message displayed on the dashboard
    const mainTypeLabel = Array.isArray(skinProfile.skinType) 
      ? skinProfile.skinType[0] 
      : skinProfile.skinType;
      
    setRecommendation({
      message: `Specially curated to treat your ${mainTypeLabel} skin profile.`,
      categories: [], // We don't need this anymore with the new logic
    });
    
  }, [skinProfile, products]);
  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Track your skincare progress</Text>
        </View>

        {/* ── Recommended Products ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended for you</Text>
          <Text style={styles.sectionSubtitle}>{recommendation.message || 'Based on your skin condition, these are recommended products.'}</Text>

          {recommendedProducts.length === 0 ? (
            <Text style={styles.emptyText}>No recommendations available</Text>
          ) : (
            recommendedProducts.slice(0, 3).map((product) => {
              const isSaved = savedProductIds.includes(product.id);
              return (
                <View key={product.id} style={styles.productCard}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitle}>{product.name}</Text>
                    <Text style={styles.productDescription}>{product.description}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => toggleSave(product.id)}
                    style={styles.saveButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isSaved ? 'bookmark' : 'bookmark-outline'}
                      size={20}
                      color={isSaved ? COLORS.primary : '#aaa'}
                    />
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          <Pressable onPress={() => router.push('../productsPage')}>
            <Text style={styles.viewAll}>View All →</Text>
          </Pressable>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={24} color="#ff6b6b" />
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={24} color="#51cf66" />
            <Text style={styles.statValue}>{stats.totalCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="notifications-circle" size={24} color="#4ecdc4" />
            <Text style={styles.statValue}>{pendingReminders.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        {/* ── Skin Analysis Graph ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skin Analysis</Text>
          <Text style={styles.sectionSubtitle}>Your latest skin health overview</Text>
          <SkinAnalysisChart />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: 14, color: COLORS.textSecondary },

  // Section
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  sectionSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, marginBottom: 10 },

  // Product Card
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  productInfo: { flex: 1 },
  productTitle: { fontWeight: '700', fontSize: 14, color: COLORS.textPrimary },
  productDescription: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  saveButton: { paddingLeft: 10 },

  viewAll: { color: COLORS.primary, marginTop: 8, fontWeight: '600' },
  emptyText: { fontSize: 12, color: COLORS.textSecondary },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary },
});