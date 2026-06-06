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
  return price === null ? 'Not listed' : `RM ${price.toFixed(2)}`;
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

  useEffect(() => { getAllProducts().then(setProducts); }, []);

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
    } catch {
      setSavedIds((prev) => isSaved ? [...prev, id] : prev.filter((i) => i !== id));
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= COMPARE_LIMIT) return prev;
      return [...prev, id];
    });
  };

  const recommendedIds = useMemo(() => {
    if (!userSkinType) return new Set<string>();
    const ids = new Set<string>();
    products.forEach((p) => {
      if (!p.skinType || !p.skinConcern) return;
      const pTypes = Array.isArray(p.skinType) ? p.skinType : [p.skinType];
      const pConcerns = Array.isArray(p.skinConcern) ? p.skinConcern : [p.skinConcern];
      const uTypes = Array.isArray(userSkinType) ? userSkinType : [userSkinType];
      const matchType = pTypes.some((t) => t && uTypes.map(x => x.toLowerCase()).includes(t.toLowerCase()));
      const matchConcern = userSkinConcern.length === 0 ||
        pConcerns.some((c) => c && userSkinConcern.map(x => x.toLowerCase()).includes(c.toLowerCase()));
      if (matchType && matchConcern) ids.add(p.id);
    });
    return ids;
  }, [products, userSkinType, userSkinConcern]);

  const filteredProducts = useMemo(() => {
    let list = selectedCategory === 'Wishlist'
      ? products.filter((p) => savedIds.includes(p.id))
      : selectedCategory === 'All'
      ? products
      : products.filter((p) => p.category?.toLowerCase() === selectedCategory.toLowerCase());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, selectedCategory, searchQuery, savedIds]);

  const comparisonProducts = useMemo(
    () => compareIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [compareIds, products]
  );

  const renderProductCard = (item: Product) => {
    const saved = savedIds.includes(item.id);
    const selected = compareIds.includes(item.id);
    const recommended = recommendedIds.has(item.id);
    const priceDrop = hasPriceDrop(item);

    return (
      <View style={[styles.card, selected && styles.cardSelected]}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{item.category || 'Product'}</Text>
          </View>
          <Pressable onPress={() => toggleSave(item.id)} hitSlop={10}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={saved ? COLORS.primary : COLORS.textSecondary}
            />
          </Pressable>
        </View>

        {/* Name */}
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>

        {/* Price + tags */}
        <View style={styles.cardMeta}>
          <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
          {recommended && (
            <View style={styles.forYouPill}>
              <Text style={styles.forYouText}>For you</Text>
            </View>
          )}
          {priceDrop && !recommended && (
            <View style={styles.salePill}>
              <Text style={styles.saleText}>Sale</Text>
            </View>
          )}
        </View>

        {/* Compare toggle */}
        <Pressable
          style={[styles.compareBtn, selected && styles.compareBtnActive]}
          onPress={() => toggleCompare(item.id)}
          disabled={!selected && compareIds.length >= COMPARE_LIMIT}
        >
          <Ionicons
            name={selected ? 'checkmark-circle' : 'git-compare-outline'}
            size={13}
            color={selected ? '#fff' : COLORS.primary}
          />
          <Text style={[styles.compareBtnText, selected && styles.compareBtnTextActive]}>
            {selected ? 'Selected' : 'Compare'}
          </Text>
        </Pressable>
      </View>
    );
  };

  const listLabel = searchQuery
    ? `"${searchQuery}"`
    : selectedCategory === 'All' ? 'All Products' : selectedCategory;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, compareIds.length > 0 && { paddingBottom: 88 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.headerTitle}>Products</Text>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={COLORS.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((cat) => {
            const label = cat === 'Wishlist' && savedIds.length > 0
              ? `Wishlist (${savedIds.length})`
              : cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.chip, selectedCategory === cat && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* List header */}
        <View style={styles.listHeader}>
          <Text style={styles.listLabel}>{listLabel}</Text>
          <Text style={styles.listCount}>{filteredProducts.length}</Text>
        </View>

        {/* Grid */}
        {filteredProducts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={34} color={COLORS.border} />
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
              <View style={styles.gridItem}>{renderProductCard(item)}</View>
            )}
          />
        )}
      </ScrollView>

      {/* Floating compare bar */}
      {compareIds.length > 0 && (
        <View style={styles.compareBar}>
          <Text style={styles.compareBarLabel}>{compareIds.length} selected</Text>
          <View style={styles.compareBarActions}>
            <Pressable style={styles.clearBtn} onPress={() => setCompareIds([])}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
            <Pressable
              style={[styles.compareBarBtn, compareIds.length < 2 && styles.compareBarBtnOff]}
              onPress={() => compareIds.length >= 2 && setComparisonVisible(true)}
              disabled={compareIds.length < 2}
            >
              <Ionicons name="git-compare-outline" size={14} color="#fff" />
              <Text style={styles.compareBarBtnText}>Compare</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Comparison modal */}
      <Modal
        visible={comparisonVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setComparisonVisible(false)}
      >
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Comparison</Text>
              <Text style={styles.modalSubtitle}>Ingredients · Prices · Reviews</Text>
            </View>
            <Pressable onPress={() => setComparisonVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textPrimary} />
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
                  {hasPriceDrop(product) && (
                    <Text style={styles.comparePositive}>↓ from {formatPrice(product.originalPrice)}</Text>
                  )}
                </View>
                <View style={styles.compareBlock}>
                  <Text style={styles.compareLabel}>Ingredients</Text>
                  <Text style={styles.compareValue}>
                    {product.activeIngredients?.length ? product.activeIngredients.join(', ') : 'Not listed'}
                  </Text>
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

                <Pressable style={styles.removeBtn} onPress={() => toggleCompare(product.id)}>
                  <Text style={styles.removeBtnText}>Remove</Text>
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
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },

  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.card, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  // Chips
  chips: { gap: 7, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  // List header
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  listCount: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    backgroundColor: COLORS.inputBackground, paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 10,
  },

  // Grid
  gridRow: { gap: 10 },
  gridItem: { width: CARD_WIDTH },

  // Product card
  card: {
    backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 12, marginBottom: 10, gap: 7,
  },
  cardSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(27,58,107,0.04)' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryPill: {
    backgroundColor: 'rgba(27,58,107,0.08)', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 8,
  },
  categoryPillText: { fontSize: 10, fontWeight: '700', color: COLORS.primary, textTransform: 'capitalize' },
  cardName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 19 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardPrice: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
  forYouPill: {
    backgroundColor: 'rgba(27,58,107,0.1)', paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6,
  },
  forYouText: { fontSize: 9, fontWeight: '800', color: COLORS.primary },
  salePill: {
    backgroundColor: 'rgba(10,127,67,0.1)', paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6,
  },
  saleText: { fontSize: 9, fontWeight: '800', color: '#0a7f43' },
  compareBtn: {
    minHeight: 30, borderRadius: 9, borderWidth: 1, borderColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  compareBtnActive: { backgroundColor: COLORS.primary },
  compareBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  compareBtnTextActive: { color: '#fff' },

  // Floating compare bar
  compareBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.card, paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 10,
  },
  compareBarLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  compareBarActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  clearBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.inputBackground,
  },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  compareBarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  compareBarBtnOff: { opacity: 0.4 },
  compareBarBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Comparison modal
  modalScreen: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  modalSubtitle: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500', marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.inputBackground,
  },
  compareColumns: { padding: 20, gap: 12 },
  compareCard: {
    width: 220, backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, gap: 10,
  },
  compareName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 20 },
  compareBlock: { gap: 3, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 9 },
  compareLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  compareValue: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 17 },
  comparePositive: { fontSize: 11, color: '#0a7f43', fontWeight: '700' },
  removeBtn: {
    alignItems: 'center', justifyContent: 'center', minHeight: 32,
    borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)',
  },
  removeBtnText: { fontSize: 12, fontWeight: '700', color: '#ff6b6b' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary },
});
