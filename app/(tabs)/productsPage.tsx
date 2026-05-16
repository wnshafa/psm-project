import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const CARD_WIDTH = (Dimensions.get('window').width - 40 - 10) / 2; // padding 20 each side, gap 10
import { SafeAreaView } from 'react-native-safe-area-context';
import ProductCard from '../../src/components/ProductCard';
import { COLORS } from '../../src/constants/theme';
import { auth, db } from '../../src/lib/firebase';
import { getAllProducts } from '../../src/services/productService';
import { Product } from '../../src/types';

const CATEGORIES = ['All', 'Cleanser', 'Moisturizer', 'Serum', 'Sunscreen', 'Toner'];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [userSkinType, setUserSkinType] = useState('');
  const [userSkinConcern, setUserSkinConcern] = useState<string[]>([]);

  useEffect(() => {
    getAllProducts().then(setProducts);
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    return onSnapshot(doc(db, 'clients', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserSkinType(data.skinType || '');
        setUserSkinConcern(
          Array.isArray(data.skinConcern) ? data.skinConcern : data.skinConcern ? [data.skinConcern] : []
        );
      }
    });
  }, []);

  const toggleSave = (id: string) =>
    setSavedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const recommendedProducts = useMemo(() => {
    if (!userSkinType) return [];
    return products.filter((p) => {
      if (!p.skinType || !p.skinConcern) return false;
      const pTypes = Array.isArray(p.skinType) ? p.skinType : [p.skinType];
      const pConcerns = Array.isArray(p.skinConcern) ? p.skinConcern : [p.skinConcern];
      const uTypes = Array.isArray(userSkinType) ? userSkinType : [userSkinType];
      const uConcerns = userSkinConcern.length > 0 ? userSkinConcern : [];
      const matchType = pTypes.some((t) => t && uTypes.map(x => x.toLowerCase()).includes(t.toLowerCase()));
      const matchConcern = uConcerns.length === 0 || pConcerns.some((c) => c && uConcerns.map(x => x.toLowerCase()).includes(c.toLowerCase()));
      return matchType && matchConcern;
    });
  }, [products, userSkinType, userSkinConcern]);

  const filteredProducts = useMemo(() => {
    let list = selectedCategory === 'All'
      ? products
      : products.filter((p) => p.category?.toLowerCase() === selectedCategory.toLowerCase());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, selectedCategory, searchQuery]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Text style={styles.headerTitle}>Products</Text>

        {/* ── Search ── */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* ── Category Chips ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Recommended ── */}
        {recommendedProducts.length > 0 && !searchQuery && (
          <View>
            <View style={styles.sectionHeader}>
              <Ionicons name="sparkles" size={16} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Recommended for you</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedList}>
              {recommendedProducts.map((p) => (
                <View key={p.id} style={styles.recommendedCard}>
                  <View style={styles.recommendedTop}>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>{p.category || 'Product'}</Text>
                    </View>
                    <Pressable onPress={() => toggleSave(p.id)} hitSlop={8}>
                      <Ionicons
                        name={savedIds.includes(p.id) ? 'bookmark' : 'bookmark-outline'}
                        size={18}
                        color={savedIds.includes(p.id) ? COLORS.primary : COLORS.textSecondary}
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.recommendedName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.recommendedDesc} numberOfLines={2}>{p.description}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── All Products ── */}
        <View>
          <Text style={styles.sectionTitle}>
            {searchQuery ? `Results for "${searchQuery}"` : selectedCategory === 'All' ? 'All Products' : selectedCategory}
            <Text style={styles.countText}> ({filteredProducts.length})</Text>
          </Text>

          {filteredProducts.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={36} color={COLORS.border} />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          ) : (
            <FlatList
              key="two-col"
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.gridRow}
              renderItem={({ item }) => (
                <View style={styles.gridItem}>
                  <ProductCard
                    id={item.id}
                    title={item.name}
                    category={item.category}
                    description={item.description}
                    isSaved={savedIds.includes(item.id)}
                    onSave={toggleSave}
                  />
                </View>
              )}
            />
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },

  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary },

  // Chips
  chips: { gap: 8, paddingRight: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  countText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },

  // Recommended horizontal cards
  recommendedList: { gap: 12, paddingRight: 4, paddingBottom: 4 },
  recommendedCard: { width: 160, backgroundColor: COLORS.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  recommendedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryPill: { backgroundColor: 'rgba(212,165,116,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  categoryPillText: { fontSize: 10, fontWeight: '700', color: COLORS.primary, textTransform: 'capitalize' },
  recommendedName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  recommendedDesc: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },

  // Grid
  gridRow: { gap: 12 },
  gridItem: { width: CARD_WIDTH },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
