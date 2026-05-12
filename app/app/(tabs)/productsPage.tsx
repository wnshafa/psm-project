import {
  doc, getDoc
} from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ProductCard from '../src/components/ProductCard';
import { COLORS } from '../src/constants/theme';
import { auth, db } from '../src/lib/firebase';
import { getAllProducts } from '../src/services/productService';
import { Product } from '../src/types';
// ─── Dummy Data ───────────────────────────────────────────────────────────────



// Simulated recommended IDs (replace with real logic later)
const RECOMMENDED_IDS = ['1', '3', '5', '6']

const CATEGORIES = ['All', 'Cleanser', 'Moisturizer', 'Serum', 'Sunscreen', 'Toner']

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [savedProductIds, setSavedProductIds] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('All')
const [userSkinType, setUserSkinType] = useState("")
const [userSkinConcern, setUserSkinConcern] = useState<string[]>([])
const [userAcneLevel, setUserAcneLevel] = useState("")

const recommendedProducts =
  !userSkinType || userSkinType.length === 0
    ? []
    : products.filter((p) => {
        if (!p.skinType || !p.skinConcern) return false

        const productSkinTypes = Array.isArray(p.skinType)
          ? p.skinType
          : [p.skinType]

        const productConcerns = Array.isArray(p.skinConcern)
          ? p.skinConcern
          : [p.skinConcern]

        const userTypes = Array.isArray(userSkinType)
          ? userSkinType
          : [userSkinType]

        const userConcerns = Array.isArray(userSkinConcern)
          ? userSkinConcern
          : [userSkinConcern]

        // ✅ SAFE MATCH TYPE
        const matchSkinType = productSkinTypes.some((type) =>
          type && userTypes.includes(type.toLowerCase())
        )

        // ✅ SAFE MATCH CONCERN
        const matchConcern = productConcerns.some((c) =>
          c && userConcerns.includes(c.toLowerCase())
        )

        return matchSkinType && matchConcern
      })

useEffect(() => {
  const fetchProducts = async () => {
    const data = await getAllProducts()
    setProducts(data)
  }

  fetchProducts()
}, [])

useEffect(() => {
  const fetchUser = async () => {
    const user = auth.currentUser
    if (!user) return

    const userDoc = await getDoc(doc(db, "clients", user.uid))

    if (userDoc.exists()) {
      const data = userDoc.data()
      setUserSkinType(data.skinType)
      setUserSkinConcern(
  Array.isArray(data.skinConcern)
    ? data.skinConcern
    : [data.skinConcern]
)
    }
  }

  fetchUser()
}, [])

  const filteredProducts =
  selectedCategory === 'All'
    ? products
    : products.filter((p) => {
        if (!p.category) return false

        return (
          p.category.toLowerCase() === selectedCategory.toLowerCase()
        )
      })

  const toggleSave = (id: string) => {
    setSavedProductIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const renderGridItem = ({ item, index }: { item: Product; index: number }) => (
    <View style={[styles.gridItem, index % 2 === 0 ? styles.gridItemLeft : styles.gridItemRight]}>
      <ProductCard
        id={item.id}
        title={item.name}
        category={item.category}
        description={item.description}
        isSaved={savedProductIds.includes(item.id)}
        onSave={toggleSave}   />
    </View>
  )

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Products</Text>
          <Text style={styles.headerSubtitle}>Browse and save your favourites</Text>
        </View>

        {/* ── Recommended Section ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recommended for you</Text>
            <TouchableOpacity onPress={() => setShowAll((prev) => !prev)}>
              <Text style={styles.viewAllText}>
                {showAll ? 'Show Less' : 'View All →'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSubtitle}>
            Based on your skin condition, these are recommended products.
          </Text>

          {recommendedProducts.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              title={product.name}
              description={product.description}
              category={product.category}
              isSaved={savedProductIds.includes(product.id)}
              onSave={toggleSave}
            />
          ))}
        </View>

        {/* ── View All Section ── */}
        {showAll && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Products</Text>

            {/* Category Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContent}
            >
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.filterChip,
                    selectedCategory === cat && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedCategory === cat && styles.filterChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 2-Column Grid */}
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              renderItem={renderGridItem}
              columnWrapperStyle={styles.gridRow}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No products in this category.</Text>
              }
            />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

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
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  sectionSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 },
  viewAllText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // Filter chips
  filterScroll: { marginBottom: 12 },
  filterContent: { gap: 8, paddingRight: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Grid
  gridRow: { gap: 8 },
  gridItem: { flex: 1 },
  gridItemLeft: { marginRight: 4 },
  gridItemRight: { marginLeft: 4 },

  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 20 },
})