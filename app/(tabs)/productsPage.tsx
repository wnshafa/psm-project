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

// ── Ingredient compatibility ──────────────────────────────────────────────────

type IngredientGroup = 'aha' | 'bha' | 'retinoid' | 'vitamin_c' | 'benzoyl_peroxide' | 'niacinamide';
type Severity = 'caution' | 'avoid';

const INGREDIENT_GROUPS: Record<IngredientGroup, string[]> = {
  aha:              ['glycolic acid', 'lactic acid', 'mandelic acid', 'tartaric acid', 'citric acid', 'malic acid', 'aha', 'alpha hydroxy'],
  bha:              ['salicylic acid', 'bha', 'beta hydroxy', 'willow bark'],
  retinoid:         ['retinol', 'retinal', 'retinoic acid', 'tretinoin', 'retinyl', 'adapalene', 'retinoid'],
  vitamin_c:        ['ascorbic acid', 'vitamin c', 'sodium ascorbyl phosphate', 'ascorbyl glucoside', 'l-ascorbic'],
  benzoyl_peroxide: ['benzoyl peroxide'],
  niacinamide:      ['niacinamide', 'nicotinamide'],
};

const CONFLICT_RULES: Array<{ a: IngredientGroup; b: IngredientGroup; severity: Severity; reason: string }> = [
  { a: 'retinoid', b: 'aha',              severity: 'avoid',   reason: 'Retinoids + AHAs risk irritation and over-exfoliation' },
  { a: 'retinoid', b: 'bha',              severity: 'avoid',   reason: 'Retinoids + BHAs risk irritation and over-exfoliation' },
  { a: 'retinoid', b: 'vitamin_c',        severity: 'caution', reason: 'Vitamin C may destabilise retinoids and reduce efficacy' },
  { a: 'retinoid', b: 'benzoyl_peroxide', severity: 'avoid',   reason: 'Benzoyl peroxide degrades retinol, making it ineffective' },
  { a: 'aha',      b: 'bha',              severity: 'caution', reason: 'Layering AHAs + BHAs may cause over-exfoliation' },
  { a: 'niacinamide', b: 'vitamin_c',     severity: 'caution', reason: 'May reduce each other\'s absorption at high concentrations' },
];

function detectGroups(ingredients: string[]): Set<IngredientGroup> {
  const found = new Set<IngredientGroup>();
  const lower = ingredients.map(i => i.toLowerCase());
  for (const [group, keywords] of Object.entries(INGREDIENT_GROUPS) as [IngredientGroup, string[]][]) {
    if (keywords.some(kw => lower.some(i => i.includes(kw)))) found.add(group);
  }
  return found;
}

interface Conflict { severity: Severity; reason: string }
interface CompatResult { conflicts: Conflict[]; status: 'safe' | 'caution' | 'incompatible'; hasData: boolean }

function checkCompatibility(products: Product[]): CompatResult {
  const all = products.flatMap(p => p.activeIngredients ?? []);
  if (all.length === 0) return { conflicts: [], status: 'safe', hasData: false };
  const groups = detectGroups(all);
  const conflicts: Conflict[] = [];
  for (const rule of CONFLICT_RULES) {
    if (groups.has(rule.a) && groups.has(rule.b))
      conflicts.push({ severity: rule.severity, reason: rule.reason });
  }
  const status = conflicts.some(c => c.severity === 'avoid')
    ? 'incompatible'
    : conflicts.length > 0 ? 'caution' : 'safe';
  return { conflicts, status, hasData: true };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CARD_WIDTH = (Dimensions.get('window').width - 40 - 10) / 2;
const CATEGORIES = ['All', 'Wishlist', 'Cleanser', 'Moisturizer', 'Serum', 'Sunscreen', 'Toner'];
const COMPARE_LIMIT = 3;

const toNumber = (v?: number | string) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const formatPrice = (v?: number | string) => {
  const n = toNumber(v); return n == null ? 'Not listed' : `RM ${n.toFixed(2)}`;
};
const formatList = (v?: string | string[]) =>
  !v ? 'Not listed' : Array.isArray(v) ? v.join(', ') : v;
const hasPriceDrop = (p: Product) => {
  const price = toNumber(p.price), orig = toNumber(p.originalPrice);
  return price != null && orig != null && orig > price;
};
const getReviewLabel = (p: Product) => {
  const r = toNumber(p.rating), c = toNumber(p.reviewCount);
  if (r == null && c == null) return 'No reviews yet';
  if (r != null && c != null) return `${r.toFixed(1)} (${c} reviews)`;
  if (r != null) return `${r.toFixed(1)} rating`;
  return `${c} reviews`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts]               = useState<Product[]>([]);
  const [savedIds, setSavedIds]               = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery]         = useState('');
  const [userSkinType, setUserSkinType]       = useState('');
  const [userSkinConcern, setUserSkinConcern] = useState<string[]>([]);
  const [compareIds, setCompareIds]           = useState<string[]>([]);
  const [comparisonVisible, setComparisonVisible] = useState(false);
  const [detailProduct, setDetailProduct]     = useState<Product | null>(null);

  useEffect(() => { getAllProducts().then(setProducts); }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    return onSnapshot(doc(db, 'clients', user.uid), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setUserSkinType(d.skinType || '');
      setSavedIds(Array.isArray(d.wishlistProductIds) ? d.wishlistProductIds : []);
      setUserSkinConcern(Array.isArray(d.skinConcern) ? d.skinConcern : d.skinConcern ? [d.skinConcern] : []);
    });
  }, []);

  const toggleSave = async (id: string) => {
    const user = auth.currentUser;
    const isSaved = savedIds.includes(id);
    setSavedIds(prev => isSaved ? prev.filter(i => i !== id) : [...prev, id]);
    if (!user) return;
    try {
      await setDoc(doc(db, 'clients', user.uid),
        { wishlistProductIds: isSaved ? arrayRemove(id) : arrayUnion(id) },
        { merge: true });
    } catch {
      setSavedIds(prev => isSaved ? [...prev, id] : prev.filter(i => i !== id));
    }
  };

  const toggleCompare = (id: string) => setCompareIds(prev => {
    if (prev.includes(id)) return prev.filter(i => i !== id);
    if (prev.length >= COMPARE_LIMIT) return prev;
    return [...prev, id];
  });

  const recommendedIds = useMemo(() => {
    if (!userSkinType) return new Set<string>();
    const ids = new Set<string>();
    products.forEach(p => {
      if (!p.skinType || !p.skinConcern) return;
      const pTypes = Array.isArray(p.skinType) ? p.skinType : [p.skinType];
      const pConcerns = Array.isArray(p.skinConcern) ? p.skinConcern : [p.skinConcern];
      const uTypes = Array.isArray(userSkinType) ? userSkinType : [userSkinType];
      const matchType = pTypes.some(t => t && uTypes.map(x => x.toLowerCase()).includes(t.toLowerCase()));
      const matchConcern = userSkinConcern.length === 0 ||
        pConcerns.some(c => c && userSkinConcern.map(x => x.toLowerCase()).includes(c.toLowerCase()));
      if (matchType && matchConcern) ids.add(p.id);
    });
    return ids;
  }, [products, userSkinType, userSkinConcern]);

  const filteredProducts = useMemo(() => {
    let list = selectedCategory === 'Wishlist'
      ? products.filter(p => savedIds.includes(p.id))
      : selectedCategory === 'All' ? products
      : products.filter(p => p.category?.toLowerCase() === selectedCategory.toLowerCase());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCategory, searchQuery, savedIds]);

  const comparisonProducts = useMemo(
    () => compareIds.map(id => products.find(p => p.id === id)).filter(Boolean) as Product[],
    [compareIds, products]
  );

  const compat = useMemo(() => checkCompatibility(comparisonProducts), [comparisonProducts]);

  // ── Product card ────────────────────────────────────────────────────────────
  const renderProductCard = (item: Product) => {
    const saved      = savedIds.includes(item.id);
    const selected   = compareIds.includes(item.id);
    const recommended = recommendedIds.has(item.id);
    const priceDrop  = hasPriceDrop(item);

    return (
      <Pressable
        style={[styles.card, selected && styles.cardSelected]}
        onPress={() => setDetailProduct(item)}
      >
        <View style={styles.cardTop}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{item.category || 'Product'}</Text>
          </View>
          <Pressable onPress={() => toggleSave(item.id)} hitSlop={10}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18}
              color={saved ? COLORS.primary : COLORS.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>

        <View style={styles.cardMeta}>
          <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
          {recommended && <View style={styles.forYouPill}><Text style={styles.forYouText}>For you</Text></View>}
          {priceDrop && !recommended && <View style={styles.salePill}><Text style={styles.saleText}>Sale</Text></View>}
        </View>

        <Pressable
          style={[styles.compareBtn, selected && styles.compareBtnActive]}
          onPress={() => toggleCompare(item.id)}
          disabled={!selected && compareIds.length >= COMPARE_LIMIT}
        >
          <Ionicons name={selected ? 'checkmark-circle' : 'git-compare-outline'} size={13}
            color={selected ? '#fff' : COLORS.primary} />
          <Text style={[styles.compareBtnText, selected && styles.compareBtnTextActive]}>
            {selected ? 'Selected' : 'Compare'}
          </Text>
        </Pressable>
      </Pressable>
    );
  };

  // ── Compatibility badge helper ───────────────────────────────────────────────
  const compatConfig = {
    safe:         { icon: 'checkmark-circle' as const, color: '#0a7f43', bg: 'rgba(10,127,67,0.08)', label: 'Safe to use together' },
    caution:      { icon: 'warning'          as const, color: '#b45309', bg: 'rgba(180,83,9,0.08)',  label: 'Use with caution' },
    incompatible: { icon: 'close-circle'     as const, color: '#dc2626', bg: 'rgba(220,38,38,0.08)', label: 'Not recommended together' },
  };

  const listLabel = searchQuery ? `"${searchQuery}"` : selectedCategory === 'All' ? 'All Products' : selectedCategory;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.headerTitle}>Products</Text>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={COLORS.textSecondary} />
          <TextInput style={styles.searchInput} placeholder="Search products..."
            placeholderTextColor={COLORS.textSecondary} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={COLORS.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map(cat => (
            <Pressable key={cat} onPress={() => setSelectedCategory(cat)}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}>
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                {cat === 'Wishlist' && savedIds.length > 0 ? `Wishlist (${savedIds.length})` : cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Compare banner */}
        {compareIds.length > 0 && (
          <View style={styles.compareBanner}>
            <View style={styles.compareBannerLeft}>
              <Ionicons name="git-compare-outline" size={15} color={COLORS.primary} />
              <Text style={styles.compareBannerLabel}>
                {compareIds.length} item{compareIds.length > 1 ? 's' : ''} selected
              </Text>
            </View>
            <View style={styles.compareBannerRight}>
              <Pressable onPress={() => setCompareIds([])}>
                <Text style={styles.compareBannerClear}>Clear</Text>
              </Pressable>
              <Pressable
                style={[styles.compareBannerBtn, compareIds.length < 2 && styles.compareBannerBtnOff]}
                onPress={() => compareIds.length >= 2 && setComparisonVisible(true)}
                disabled={compareIds.length < 2}
              >
                <Text style={styles.compareBannerBtnText}>Compare</Text>
              </Pressable>
            </View>
          </View>
        )}

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
          <FlatList key="two-col" data={filteredProducts} keyExtractor={i => i.id}
            numColumns={2} scrollEnabled={false} columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => <View style={styles.gridItem}>{renderProductCard(item)}</View>} />
        )}
      </ScrollView>

      {/* ── Product detail modal ─────────────────────────────────────────────── */}
      <Modal visible={!!detailProduct} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setDetailProduct(null)}>
        {detailProduct && (
          <SafeAreaView style={styles.modalScreen}>
            {/* header */}
            <View style={styles.modalHeader}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>{detailProduct.category || 'Product'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Pressable onPress={() => toggleSave(detailProduct.id)} style={styles.closeBtn}>
                  <Ionicons name={savedIds.includes(detailProduct.id) ? 'bookmark' : 'bookmark-outline'}
                    size={18} color={savedIds.includes(detailProduct.id) ? COLORS.primary : COLORS.textSecondary} />
                </Pressable>
                <Pressable onPress={() => setDetailProduct(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color={COLORS.textPrimary} />
                </Pressable>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.detailScroll}>
              {/* Name + price */}
              <Text style={styles.detailName}>{detailProduct.name}</Text>
              <View style={styles.detailPriceRow}>
                <Text style={styles.detailPrice}>{formatPrice(detailProduct.price)}</Text>
                {hasPriceDrop(detailProduct) && (
                  <Text style={styles.detailOrigPrice}>{formatPrice(detailProduct.originalPrice)}</Text>
                )}
                {recommendedIds.has(detailProduct.id) && (
                  <View style={styles.forYouPill}><Text style={styles.forYouText}>For you</Text></View>
                )}
              </View>

              {/* Reviews */}
              {(toNumber(detailProduct.rating) != null || toNumber(detailProduct.reviewCount) != null) && (
                <View style={styles.detailReviewRow}>
                  <Ionicons name="star" size={13} color="#f59e0b" />
                  <Text style={styles.detailReviewText}>{getReviewLabel(detailProduct)}</Text>
                </View>
              )}

              {/* Description */}
              {detailProduct.description ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionLabel}>About</Text>
                  <Text style={styles.detailBody}>{detailProduct.description}</Text>
                </View>
              ) : null}

              {/* Active ingredients */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionLabel}>Active Ingredients</Text>
                {detailProduct.activeIngredients?.length ? (
                  <View style={styles.ingredientWrap}>
                    {detailProduct.activeIngredients.map((ing, i) => (
                      <View key={i} style={styles.ingredientChip}>
                        <Text style={styles.ingredientText}>{ing}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.detailBody}>Not listed</Text>
                )}
              </View>

              {/* Skin profile */}
              <View style={styles.detailRow}>
                <View style={[styles.detailSection, { flex: 1 }]}>
                  <Text style={styles.detailSectionLabel}>Best for</Text>
                  <Text style={styles.detailBody}>{formatList(detailProduct.skinType)}</Text>
                </View>
                <View style={[styles.detailSection, { flex: 1 }]}>
                  <Text style={styles.detailSectionLabel}>Concerns</Text>
                  <Text style={styles.detailBody}>{formatList(detailProduct.skinConcern)}</Text>
                </View>
              </View>

              {/* Compare action */}
              <Pressable
                style={[
                  styles.detailCompareBtn,
                  compareIds.includes(detailProduct.id) && styles.detailCompareBtnActive,
                  !compareIds.includes(detailProduct.id) && compareIds.length >= COMPARE_LIMIT && styles.detailCompareBtnDisabled,
                ]}
                onPress={() => toggleCompare(detailProduct.id)}
                disabled={!compareIds.includes(detailProduct.id) && compareIds.length >= COMPARE_LIMIT}
              >
                <Ionicons
                  name={compareIds.includes(detailProduct.id) ? 'checkmark-circle' : 'git-compare-outline'}
                  size={16}
                  color={compareIds.includes(detailProduct.id) ? '#fff' : COLORS.primary}
                />
                <Text style={[styles.detailCompareBtnText,
                  compareIds.includes(detailProduct.id) && styles.detailCompareBtnTextActive]}>
                  {compareIds.includes(detailProduct.id) ? 'Remove from compare' : 'Add to compare'}
                </Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ── Comparison modal ─────────────────────────────────────────────────── */}
      <Modal visible={comparisonVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setComparisonVisible(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Comparison</Text>
              <Text style={styles.modalSubtitle}>{comparisonProducts.length} products</Text>
            </View>
            <Pressable onPress={() => setComparisonVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          {/* Compatibility summary */}
          {compat.hasData ? (
            <View style={[styles.compatBox, { backgroundColor: compatConfig[compat.status].bg }]}>
              <View style={styles.compatHeader}>
                <Ionicons name={compatConfig[compat.status].icon} size={18}
                  color={compatConfig[compat.status].color} />
                <Text style={[styles.compatTitle, { color: compatConfig[compat.status].color }]}>
                  {compatConfig[compat.status].label}
                </Text>
              </View>
              {compat.conflicts.map((c, i) => (
                <View key={i} style={styles.compatRow}>
                  <Ionicons
                    name={c.severity === 'avoid' ? 'close-circle-outline' : 'alert-circle-outline'}
                    size={13}
                    color={c.severity === 'avoid' ? '#dc2626' : '#b45309'}
                  />
                  <Text style={[styles.compatReason,
                    { color: c.severity === 'avoid' ? '#dc2626' : '#b45309' }]}>
                    {c.reason}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.compatBox, { backgroundColor: COLORS.inputBackground }]}>
              <Text style={styles.compatNoData}>
                Ingredient data not available for these products — compatibility cannot be assessed.
              </Text>
            </View>
          )}

          {/* Side-by-side columns */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compareColumns}>
            {comparisonProducts.map(product => (
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
                  <Text style={styles.compareLabel}>Active Ingredients</Text>
                  {product.activeIngredients?.length ? (
                    <View style={{ gap: 3, marginTop: 2 }}>
                      {product.activeIngredients.map((ing, i) => (
                        <View key={i} style={styles.ingredientChipSmall}>
                          <Text style={styles.ingredientTextSmall}>{ing}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.compareValue}>Not listed</Text>
                  )}
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
  screen:     { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  scroll:     { padding: 20, paddingBottom: 40, gap: 12 },

  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.card, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  chips:         { gap: 7, paddingRight: 4 },
  chip:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:      { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive:{ color: '#fff' },

  compareBanner:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(27,58,107,0.07)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(27,58,107,0.15)' },
  compareBannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  compareBannerLabel: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  compareBannerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compareBannerClear: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  compareBannerBtn:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: COLORS.primary },
  compareBannerBtnOff:{ opacity: 0.35 },
  compareBannerBtnText:{ fontSize: 12, fontWeight: '700', color: '#fff' },

  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listLabel:  { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  listCount:  { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, backgroundColor: COLORS.inputBackground, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },

  gridRow:  { gap: 10 },
  gridItem: { width: CARD_WIDTH },

  card:         { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 10, gap: 7 },
  cardSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(27,58,107,0.04)' },
  cardTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryPill: { backgroundColor: 'rgba(27,58,107,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  categoryPillText: { fontSize: 10, fontWeight: '700', color: COLORS.primary, textTransform: 'capitalize' },
  cardName:  { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 19 },
  cardMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardPrice: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary },
  forYouPill: { backgroundColor: 'rgba(27,58,107,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  forYouText: { fontSize: 9, fontWeight: '800', color: COLORS.primary },
  salePill:   { backgroundColor: 'rgba(10,127,67,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  saleText:   { fontSize: 9, fontWeight: '800', color: '#0a7f43' },
  compareBtn:          { minHeight: 30, borderRadius: 9, borderWidth: 1, borderColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  compareBtnActive:    { backgroundColor: COLORS.primary },
  compareBtnText:      { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  compareBtnTextActive:{ color: '#fff' },

  // ── Detail modal ────────────────────────────────────────────────────────────
  modalScreen: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  modalSubtitle: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500', marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.inputBackground },

  detailScroll:    { padding: 20, gap: 16, paddingBottom: 40 },
  detailName:      { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 28 },
  detailPriceRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  detailPrice:     { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  detailOrigPrice: { fontSize: 13, color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  detailReviewRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailReviewText:{ fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  detailSection:   { gap: 6 },
  detailRow:       { flexDirection: 'row', gap: 16 },
  detailSectionLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailBody:      { fontSize: 14, color: COLORS.textPrimary, lineHeight: 21 },
  ingredientWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ingredientChip:  { backgroundColor: 'rgba(27,58,107,0.08)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  ingredientText:  { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  ingredientChipSmall: { backgroundColor: 'rgba(27,58,107,0.08)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  ingredientTextSmall: { fontSize: 10, fontWeight: '600', color: COLORS.primary },
  detailCompareBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primary },
  detailCompareBtnActive:   { backgroundColor: COLORS.primary },
  detailCompareBtnDisabled: { opacity: 0.4 },
  detailCompareBtnText:     { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  detailCompareBtnTextActive: { color: '#fff' },

  // ── Compatibility ───────────────────────────────────────────────────────────
  compatBox:    { marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 12, gap: 8 },
  compatHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compatTitle:  { fontSize: 14, fontWeight: '800' },
  compatRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  compatReason: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  compatNoData: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },

  // ── Compare columns ─────────────────────────────────────────────────────────
  compareColumns: { padding: 20, gap: 12 },
  compareCard:    { width: 220, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14, gap: 10 },
  compareName:    { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 20 },
  compareBlock:   { gap: 4, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 9 },
  compareLabel:   { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  compareValue:   { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 17 },
  comparePositive:{ fontSize: 11, color: '#0a7f43', fontWeight: '700' },
  removeBtn:      { alignItems: 'center', justifyContent: 'center', minHeight: 32, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)' },
  removeBtnText:  { fontSize: 12, fontWeight: '700', color: '#ff6b6b' },

  empty:     { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary },
});
