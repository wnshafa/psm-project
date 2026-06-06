import { Ionicons } from '@expo/vector-icons';
import { arrayRemove, arrayUnion, doc, onSnapshot, setDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/theme';
import { auth, db } from '../../src/lib/firebase';
import { getAllProducts } from '../../src/services/productService';
import { Product } from '../../src/types';

const CARD_WIDTH = (Dimensions.get('window').width - 40 - 10) / 2;

const CATEGORIES = ['All', 'Wishlist', 'Cleanser', 'Moisturizer', 'Serum', 'Sunscreen', 'Toner'];
const COMPARE_LIMIT = 3;

const toNumber = (value?: number | string) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPrice = (value?: number | string) => {
  const price = toNumber(value);
  if (price === null) return 'Not listed';
  return `RM ${price.toFixed(2)}`;
};

const formatList = (value?: string | string[]) => {
  if (!value) return 'Not listed';
  return Array.isArray(value) ? value.join(', ') : value;
};

const hasPriceDrop = (product: Product) => {
  const price = toNumber(product.price);
  const original = toNumber(product.originalPrice);
  return price !== null && original !== null && original > price;
};

const getReviewLabel = (product: Product) => {
  const rating = toNumber(product.rating);
  const count = toNumber(product.reviewCount);
  if (rating === null && count === null) return 'No reviews yet';
  if (rating !== null && count !== null) return `${rating.toFixed(1)} (${count} reviews)`;
  if (rating !== null) return `${rating.toFixed(1)} rating`;
  return `${count} reviews`;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [userSkinType, setUserSkinType] = useState('');
  const [userSkinConcern, setUserSkinConcern] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparisonVisible, setComparisonVisible] = useState(false);

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
        setSavedIds(Array.isArray(data.wishlistProductIds) ? data.wishlistProductIds : []);
        setUserSkinConcern(
          Array.isArray(data.skinConcern) ? data.skinConcern : data.skinConcern ? [data.skinConcern] : []
        );
      }
    });
  }, []);

  const toggleSave = async (id: string) => {
    const user = auth.currentUser;
    const isSaved = savedIds.includes(id);
    setSavedIds((prev) => isSaved ? prev.filter((i) => i !== id) : [...prev, id]);

    if (!user) return;
    try {
      await setDoc(
        doc(db, 'clients', user.uid),
        { wishlistProductIds: isSaved ? arrayRemove(id) : arrayUnion(id) },
        { merge: true }
      );
    } catch (error) {
      setSavedIds((prev) => isSaved ? [...prev, id] : prev.filter((i) => i !== id));
      console.warn('Failed to update wishlist:', error);
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= COMPARE_LIMIT) return prev;
      return [...prev, id];
    });
  };

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

  const wishlistProducts = useMemo(
    () => products.filter((product) => savedIds.includes(product.id)),
    [products, savedIds]
  );

  const filteredProducts = useMemo(() => {
    let list = selectedCategory === 'Wishlist'
      ? wishlistProducts
      : selectedCategory === 'All'
      ? products
      : products.filter((p) => p.category?.toLowerCase() === selectedCategory.toLowerCase());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, selectedCategory, searchQuery, wishlistProducts]);

  const comparisonProducts = useMemo(
    () => compareIds.map((id) => products.find((product) => product.id === id)).filter(Boolean) as Product[],
    [compareIds, products]
  );

  const renderProductCard = (item: Product) => {
    const saved = savedIds.includes(item.id);
    const selectedForCompare = compareIds.includes(item.id);
    const priceDropped = hasPriceDrop(item);

    return (
      <View style={[styles.productCard, selectedForCompare && styles.productCardSelected]}>
        <View style={styles.productTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>{item.category || 'Product'}</Text>
            </View>
          </View>
          <Pressable onPress={() => toggleSave(item.id)} hitSlop={8} style={styles.iconBtn}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={saved ? COLORS.primary : COLORS.textSecondary}
            />
          </Pressable>
        </View>

        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productDesc} numberOfLines={2}>{item.description || 'No description added.'}</Text>

        <View style={styles.productMetaRow}>
          <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
          {priceDropped && (
            <View style={styles.dropPill}>
              <Ionicons name="trending-down" size={11} color="#0a7f43" />
              <Text style={styles.dropText}>Price drop</Text>
            </View>
          )}
        </View>

        <Pressable
          style={[styles.compareToggle, selectedForCompare && styles.compareToggleActive]}
          onPress={() => toggleCompare(item.id)}
          disabled={!selectedForCompare && compareIds.length >= COMPARE_LIMIT}
        >
          <Ionicons
            name={selectedForCompare ? 'checkmark-circle' : 'git-compare-outline'}
            size={14}
            color={selectedForCompare ? COLORS.white : COLORS.primary}
          />
          <Text style={[styles.compareToggleText, selectedForCompare && styles.compareToggleTextActive]}>
            {selectedForCompare ? 'Selected' : 'Compare'}
          </Text>
        </Pressable>
      </View>
    );
  };

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

        {/* Feature Actions */}
        <View style={styles.featureRow}>
          <View style={styles.featureCard}>
            <View style={styles.featureTitleRow}>
              <Ionicons name="bookmark" size={15} color={COLORS.primary} />
              <Text style={styles.featureTitle}>Wishlist</Text>
            </View>
            <Text style={styles.featureText}>Track products to buy later, price drops</Text>
            <Text style={styles.featureCount}>{savedIds.length} saved</Text>
          </View>
          <View style={styles.featureCard}>
            <View style={styles.featureTitleRow}>
              <Ionicons name="git-compare-outline" size={15} color={COLORS.primary} />
              <Text style={styles.featureTitle}>Comparison</Text>
            </View>
            <Text style={styles.featureText}>Side-by-side ingredients, prices, reviews</Text>
            <Pressable
              style={[styles.compareButton, comparisonProducts.length < 2 && styles.compareButtonDisabled]}
              onPress={() => setComparisonVisible(true)}
              disabled={comparisonProducts.length < 2}
            >
              <Text style={[styles.compareButtonText, comparisonProducts.length < 2 && styles.compareButtonTextDisabled]}>
                Compare {compareIds.length > 0 ? `(${compareIds.length})` : ''}
              </Text>
            </Pressable>
          </View>
        </View>

        {wishlistProducts.length > 0 && selectedCategory !== 'Wishlist' && !searchQuery && (
          <View>
            <View style={styles.sectionHeader}>
              <Ionicons name="bookmark" size={16} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Wishlist</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedList}>
              {wishlistProducts.map((p) => (
                <View key={p.id} style={styles.wishlistCard}>
                  <View style={styles.recommendedTop}>
                    <Text style={styles.wishlistName} numberOfLines={2}>{p.name}</Text>
                    <Pressable onPress={() => toggleSave(p.id)} hitSlop={8}>
                      <Ionicons name="bookmark" size={18} color={COLORS.primary} />
                    </Pressable>
                  </View>
                  <Text style={styles.wishlistMeta}>{formatPrice(p.price)}</Text>
                  {hasPriceDrop(p) ? (
                    <View style={styles.dropPill}>
                      <Ionicons name="trending-down" size={11} color="#0a7f43" />
                      <Text style={styles.dropText}>Price drop</Text>
                    </View>
                  ) : (
                    <Text style={styles.wishlistHint}>Track for later</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

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
                  <Text style={styles.recommendedPrice}>{formatPrice(p.price)}</Text>
                  {hasPriceDrop(p) && (
                    <View style={styles.dropPill}>
                      <Ionicons name="trending-down" size={11} color="#0a7f43" />
                      <Text style={styles.dropText}>Price drop</Text>
                    </View>
                  )}
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
                  {renderProductCard(item)}
                </View>
              )}
            />
          )}
        </View>

      </ScrollView>

      <Modal visible={comparisonVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComparisonVisible(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Comparison</Text>
              <Text style={styles.modalSubtitle}>Ingredients, prices, reviews</Text>
            </View>
            <Pressable onPress={() => setComparisonVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compareColumns}>
            {comparisonProducts.map((product) => (
              <View key={product.id} style={styles.compareCard}>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>{product.category || 'Product'}</Text>
                </View>
                <Text style={styles.compareName} numberOfLines={3}>{product.name}</Text>

                <View style={styles.compareBlock}>
                  <Text style={styles.compareLabel}>Price</Text>
                  <Text style={styles.compareValue}>{formatPrice(product.price)}</Text>
                  {hasPriceDrop(product) && <Text style={styles.comparePositive}>Dropped from {formatPrice(product.originalPrice)}</Text>}
                </View>

                <View style={styles.compareBlock}>
                  <Text style={styles.compareLabel}>Ingredients</Text>
                  <Text style={styles.compareValue}>{product.activeIngredients?.length ? product.activeIngredients.join(', ') : 'Not listed'}</Text>
                </View>

                <View style={styles.compareBlock}>
                  <Text style={styles.compareLabel}>Reviews</Text>
                  <Text style={styles.compareValue}>{getReviewLabel(product)}</Text>
                </View>

                <View style={styles.compareBlock}>
                  <Text style={styles.compareLabel}>Best for</Text>
                  <Text style={styles.compareValue}>{formatList(product.skinType)}</Text>
                </View>

                <View style={styles.compareBlock}>
                  <Text style={styles.compareLabel}>Concerns</Text>
                  <Text style={styles.compareValue}>{formatList(product.skinConcern)}</Text>
                </View>

                <Pressable style={styles.removeCompareBtn} onPress={() => toggleCompare(product.id)}>
                  <Ionicons name="remove-circle-outline" size={15} color="#ff6b6b" />
                  <Text style={styles.removeCompareText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

  // Feature actions
  featureRow: { flexDirection: 'row', gap: 10 },
  featureCard: { flex: 1, minHeight: 126, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12, gap: 7 },
  featureTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  featureText: { flex: 1, fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', lineHeight: 16 },
  featureCount: { fontSize: 11, color: COLORS.primary, fontWeight: '800' },
  compareButton: { minHeight: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  compareButtonDisabled: { backgroundColor: COLORS.inputBackground, borderWidth: 1, borderColor: COLORS.border },
  compareButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  compareButtonTextDisabled: { color: COLORS.textSecondary },

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
  recommendedPrice: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },

  wishlistCard: { width: 170, backgroundColor: COLORS.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border, gap: 7 },
  wishlistName: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, paddingRight: 8 },
  wishlistMeta: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
  wishlistHint: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  dropPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(10,127,67,0.1)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  dropText: { fontSize: 10, fontWeight: '800', color: '#0a7f43' },

  // Grid
  gridRow: { gap: 12 },
  gridItem: { width: CARD_WIDTH },
  productCard: { minHeight: 185, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 12, gap: 8 },
  productCardSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(27,58,107,0.05)' },
  productTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  iconBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 19 },
  productDesc: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, minHeight: 34 },
  productMetaRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  productPrice: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  compareToggle: { marginTop: 'auto', minHeight: 32, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8 },
  compareToggleActive: { backgroundColor: COLORS.primary },
  compareToggleText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  compareToggleTextActive: { color: COLORS.white },

  // Comparison modal
  modalScreen: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  modalSubtitle: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  compareColumns: { padding: 20, gap: 12 },
  compareCard: { width: 230, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 14, gap: 12 },
  compareName: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 21 },
  compareBlock: { gap: 3, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  compareLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  compareValue: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 18 },
  comparePositive: { fontSize: 11, color: '#0a7f43', fontWeight: '800' },
  removeCompareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 34, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,107,107,0.25)', backgroundColor: 'rgba(255,107,107,0.06)' },
  removeCompareText: { color: '#ff6b6b', fontSize: 12, fontWeight: '800' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
