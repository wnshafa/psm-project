import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "../../src/components/Toast";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from "../../src/constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type SkinType = "Normal" | "Dry" | "Oily" | "Combination" | "Sensitive";
type SkinConcern =
  | "Acne"
  | "Aging"
  | "Dryness"
  | "Oiliness"
  | "Sensitivity"
  | "Brightening";
type ActiveIngredient =
  | "Retinol"
  | "Vitamin C"
  | "Niacinamide"
  | "AHA"
  | "BHA"
  | "Benzoyl Peroxide"
  | "Hyaluronic Acid"
  | "Peptides"
  | "SPF";

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  skinType: SkinType;
  skinConcern: SkinConcern[];
  activeIngredients?: ActiveIngredient[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Cleanser",
  "Toner",
  "Serum",
  "Moisturiser",
  "Sunscreen",
  "Mask",
  "Eye Cream",
  "Exfoliator",
];

const SKIN_TYPES: SkinType[] = ["Normal", "Dry", "Oily", "Combination", "Sensitive"];
const SKIN_CONCERNS: SkinConcern[] = ["Acne", "Aging", "Dryness", "Oiliness", "Sensitivity", "Brightening"];
const ACTIVE_INGREDIENTS: ActiveIngredient[] = [
  "Retinol", "Vitamin C", "Niacinamide", "AHA", "BHA",
  "Benzoyl Peroxide", "Hyaluronic Acid", "Peptides", "SPF",
];

const FILTER_OPTIONS = ["All", ...CATEGORIES];

// Category → accent color
const CATEGORY_COLOR: Record<string, string> = {
  Cleanser:    "#3B82F6",
  Toner:       "#8B5CF6",
  Serum:       "#EC4899",
  Moisturiser: "#10B981",
  Sunscreen:   "#F59E0B",
  Mask:        "#6366F1",
  "Eye Cream": "#14B8A6",
  Exfoliator:  "#F97316",
};

// Category → icon
const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Cleanser:    "water-outline",
  Toner:       "flask-outline",
  Serum:       "sparkles-outline",
  Moisturiser: "leaf-outline",
  Sunscreen:   "sunny-outline",
  Mask:        "happy-outline",
  "Eye Cream": "eye-outline",
  Exfoliator:  "layers-outline",
};

// Ingredient compatibility
type IngredientKey = ActiveIngredient;
const INGREDIENT_CONFLICTS: Partial<Record<IngredientKey, { conflictsWith: IngredientKey[]; reason: string }>> = {
  Retinol:         { conflictsWith: ["Vitamin C", "AHA", "BHA", "Benzoyl Peroxide"], reason: "Can cause irritation, redness, and skin barrier damage." },
  "Vitamin C":     { conflictsWith: ["Retinol", "Niacinamide", "AHA", "BHA"],        reason: "May reduce effectiveness or cause flushing." },
  Niacinamide:     { conflictsWith: ["Vitamin C"],                                    reason: "High concentrations may cause temporary redness." },
  AHA:             { conflictsWith: ["Retinol", "Vitamin C", "BHA"],                  reason: "Over-exfoliation risk — use at different times." },
  BHA:             { conflictsWith: ["Retinol", "Vitamin C", "AHA"],                  reason: "Over-exfoliation risk — use at different times." },
  "Benzoyl Peroxide": { conflictsWith: ["Retinol", "Vitamin C"],                      reason: "Can oxidise and deactivate these actives." },
};

function getConflicts(ingredients: ActiveIngredient[]): { pair: string; reason: string }[] {
  const warnings: { pair: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const ing of ingredients) {
    const entry = INGREDIENT_CONFLICTS[ing];
    if (!entry) continue;
    for (const conflict of entry.conflictsWith) {
      if (ingredients.includes(conflict)) {
        const key = [ing, conflict].sort().join("+");
        if (!seen.has(key)) {
          seen.add(key);
          warnings.push({ pair: `${ing} + ${conflict}`, reason: entry.reason });
        }
      }
    }
  }
  return warnings;
}

const EMPTY_FORM = {
  name: "",
  category: "",
  description: "",
  skinType: "" as SkinType | "",
  skinConcern: [] as SkinConcern[],
  activeIngredients: [] as ActiveIngredient[],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManageProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // Add / Edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: "" });

  const showToast = (message: string) => setToast({ visible: true, message });

  // Real-time listener
  useEffect(() => {
    return onSnapshot(collection(db, "products"), (snapshot) => {
      const data: Product[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Product, "id">),
      }));
      setProducts(data);
    });
  }, []);

  // Filtered + searched list
  const filtered = products.filter((p) => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = activeFilter === "All" || p.category === activeFilter;
    return matchSearch && matchFilter;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openAddModal() {
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      description: product.description ?? "",
      skinType: product.skinType,
      skinConcern: product.skinConcern ?? [],
      activeIngredients: product.activeIngredients ?? [],
    });
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditingProduct(null);
  }

  function toggleConcern(concern: SkinConcern) {
    setForm((prev) => ({
      ...prev,
      skinConcern: prev.skinConcern.includes(concern)
        ? prev.skinConcern.filter((c) => c !== concern)
        : [...prev.skinConcern, concern],
    }));
  }

  function toggleIngredient(ing: ActiveIngredient) {
    setForm((prev) => ({
      ...prev,
      activeIngredients: prev.activeIngredients.includes(ing)
        ? prev.activeIngredients.filter((i) => i !== ing)
        : [...prev.activeIngredients, ing],
    }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.category || !form.skinType || form.skinConcern.length === 0 || form.activeIngredients.length === 0) {
      window.alert("Please fill in all required fields: Name, Category, Skin Type, Skin Concerns and Active Ingredients.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      skinType: form.skinType,
      skinConcern: form.skinConcern,
      activeIngredients: form.activeIngredients,
    };
    try {
      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), payload);
        showToast("Product updated.");
      } else {
        await addDoc(collection(db, "products"), payload);
        showToast("Product added.");
      }
      closeModal();
    } catch {
      Alert.alert("Error", "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(`Delete "${product.name}"?`);
    if (!confirmed) return;
    setDeletingId(product.id);
    try {
      await deleteDoc(doc(db, "products", product.id));
      showToast("Product deleted.");
    } catch {
      window.alert("Failed to delete product.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Product card ──────────────────────────────────────────────────────────

  function renderProduct({ item }: { item: Product }) {
    const categoryKey = Object.keys(CATEGORY_COLOR).find(
      (k) => k.toLowerCase() === item.category?.toLowerCase()
    ) ?? item.category;
    const accent = CATEGORY_COLOR[categoryKey] ?? COLORS.primary;
    const icon = CATEGORY_ICON[categoryKey] ?? "cube-outline";
    const conflicts = item.activeIngredients?.length ? getConflicts(item.activeIngredients) : [];

    return (
      <View style={styles.card}>
        {/* Top colour band */}
        <View style={[styles.cardBand, { backgroundColor: accent }]}>
          <View style={styles.cardBandLeft}>
            <View style={styles.cardBandIcon}>
              <Ionicons name={icon} size={16} color="#fff" />
            </View>
            <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          </View>
          {/* Action buttons */}
          <View style={styles.cardActions}>
            <Pressable
              onPress={() => openEditModal(item)}
              style={styles.editBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={13} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => handleDelete(item)}
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={deletingId === item.id}
            >
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="trash-outline" size={13} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Card body */}
        <View style={styles.cardBody}>

          {/* Skin type + concerns in one row */}
          <View style={styles.chipRow}>
            {item.skinType ? (
              <View style={[styles.skinTypePill, { backgroundColor: accent + "18", borderColor: accent + "40" }]}>
                <Text style={[styles.skinTypePillText, { color: accent }]}>{item.skinType}</Text>
              </View>
            ) : null}
            {item.skinConcern?.map((c) => (
              <View key={c} style={styles.concernPill}>
                <Text style={styles.concernPillText}>{c}</Text>
              </View>
            ))}
          </View>

          {/* Description */}
          {!!item.description && (
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          )}

          {/* Active ingredients — compact inline */}
          {item.activeIngredients && item.activeIngredients.length > 0 && (
            <View style={styles.activesBlock}>
              {/* Actives + pills + warning icon all in one line */}
              <View style={styles.activesRow}>
                <Ionicons name="flask-outline" size={11} color="#4338CA" />
                <Text style={styles.activesLabel}>Actives</Text>
                <View style={styles.ingRow}>
                  {item.activeIngredients.map((ing) => (
                    <View key={ing} style={styles.ingPill}>
                      <Text style={styles.ingPillText}>{ing}</Text>
                    </View>
                  ))}
                  <Ionicons name="warning-outline" size={12} color="#D97706" style={{ marginLeft: 2 }} />
                  {conflicts.length > 0 && (
                    <View style={styles.conflictBadge}>
                      <Text style={styles.conflictBadgeText}>{conflicts.length} conflict{conflicts.length > 1 ? "s" : ""}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Conflict detail rows */}
              {conflicts.length > 0 && (
                <View style={styles.compatBox}>
                  {conflicts.map((w) => (
                    <View key={w.pair} style={styles.conflictRow}>
                      <Text style={styles.conflictPair}>{w.pair}</Text>
                      <Text style={styles.conflictReason}>{w.reason}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      {/* ── Fixed top section ── */}
      <View style={styles.topSection}>
        {/* Page header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Product Catalog</Text>
            <Text style={styles.pageSubtitle}>
              {products.length} product{products.length !== 1 ? "s" : ""} in library
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Product</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Category filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_OPTIONS.map((opt) => {
            const isActive = activeFilter === opt;
            const accent = opt === "All" ? COLORS.primary : (CATEGORY_COLOR[opt] ?? COLORS.primary);
            return (
              <Pressable
                key={opt}
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: accent, borderColor: accent },
                ]}
                onPress={() => setActiveFilter(opt)}
              >
                {opt !== "All" && (
                  <Ionicons
                    name={CATEGORY_ICON[opt] ?? "cube-outline"}
                    size={12}
                    color={isActive ? "#fff" : COLORS.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Product grid ── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        key="grid-3"
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bag-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>No products found.</Text>
          </View>
        }
      />

      {/* ── Add / Edit Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? "Edit Product" : "New Product"}
              </Text>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScroll}
            >
              {/* ── Row 1: Name (left) + Category (right) ── */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Hydrating Toner"
                    placeholderTextColor={COLORS.textSecondary}
                    value={form.name}
                    onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Category *</Text>
                  <View style={styles.chipGrid}>
                    {CATEGORIES.map((cat) => {
                      const selected = form.category === cat;
                      const accent = CATEGORY_COLOR[cat] ?? COLORS.primary;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.chip, selected && { backgroundColor: accent + "18", borderColor: accent }]}
                          onPress={() => setForm((f) => ({ ...f, category: cat }))}
                        >
                          <Ionicons name={CATEGORY_ICON[cat] ?? "cube-outline"} size={11} color={selected ? accent : COLORS.textSecondary} style={{ marginRight: 3 }} />
                          <Text style={[styles.chipText, selected && { color: accent, fontWeight: "700" }]}>{cat}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* ── Row 2: Description (left) + Skin Type (right) ── */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="Product description..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={form.description}
                    onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Skin Type *</Text>
                  <View style={styles.chipGrid}>
                    {SKIN_TYPES.map((st) => {
                      const selected = form.skinType === st;
                      return (
                        <TouchableOpacity
                          key={st}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => setForm((f) => ({ ...f, skinType: st }))}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{st}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* ── Row 3: Concerns (left) + Actives (right) ── */}
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Skin Concerns *</Text>
                  <View style={styles.chipGrid}>
                    {SKIN_CONCERNS.map((sc) => {
                      const selected = form.skinConcern.includes(sc);
                      return (
                        <TouchableOpacity
                          key={sc}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => toggleConcern(sc)}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{sc}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>Active Ingredients *</Text>
                  <Text style={styles.fieldHint}>Compatibility warnings shown automatically.</Text>
                  <View style={styles.chipGrid}>
                    {ACTIVE_INGREDIENTS.map((ing) => {
                      const selected = form.activeIngredients.includes(ing);
                      return (
                        <TouchableOpacity
                          key={ing}
                          style={[styles.chip, selected && styles.ingChipSelected]}
                          onPress={() => toggleIngredient(ing)}
                        >
                          <Text style={[styles.chipText, selected && styles.ingChipTextSelected]}>{ing}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Footer — outside scroll */}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingProduct ? "Save Changes" : "Add Product"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast
        message={toast.message}
        visible={toast.visible}
        onHide={() => setToast({ visible: false, message: "" })}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },

  // Top section
  topSection: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  pageTitle: { fontSize: 28, fontWeight: "800", color: COLORS.textPrimary },
  pageSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontWeight: "500" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: 5,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZE.sm },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },

  // Filter chips
  filterScroll: { gap: SPACING.sm, paddingBottom: 2 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  filterChipText: { fontSize: FONT_SIZE.xs, fontWeight: "600", color: COLORS.textSecondary },
  filterChipTextActive: { color: "#fff" },

  // Grid
  list: { paddingHorizontal: 24, paddingTop: SPACING.lg, paddingBottom: 40 },
  gridRow: { gap: SPACING.md, marginBottom: SPACING.md },

  // Card
  card: {
    flex: 1,
    maxWidth: "32%",
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // Top colour band
  cardBand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  cardBandLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minWidth: 0,
  },
  cardBandIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: { padding: SPACING.md, gap: 8 },
  productName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 18,
    flexShrink: 1,
  },
  cardActions: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  editBtn: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  deleteBtn: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },

  // Skin type / concern chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  skinTypePill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 20, borderWidth: 1,
  },
  skinTypePillText: { fontSize: 11, fontWeight: "700" },
  concernPill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1, borderColor: COLORS.border,
  },
  concernPillText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500" },

  description: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 17 },

  // Actives block
  activesBlock: {
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 8, gap: 6,
  },
  activesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  activesLabel: {
    fontSize: 10, fontWeight: "700", color: "#4338CA",
    textTransform: "uppercase", letterSpacing: 0.3, marginRight: 2,
  },
  ingRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  ingPill: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 20, borderWidth: 1, borderColor: "#C7D2FE",
  },
  ingPillText: { fontSize: 10, color: "#4338CA", fontWeight: "600" },

  conflictBadge: {
    backgroundColor: "#FEE2E2", borderRadius: 20,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  conflictBadgeText: { fontSize: 9, fontWeight: "700", color: "#DC2626" },

  compatBox: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1, borderColor: "#FECACA",
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm, gap: 4,
  },
  conflictRow: { gap: 1 },
  conflictPair: { fontSize: 10, fontWeight: "700", color: "#DC2626" },
  conflictReason: { fontSize: 10, color: "#7F1D1D", lineHeight: 14 },

  // Unused — kept for modal chip consistency
  categoryPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  categoryPillText: { fontSize: 11, fontWeight: "600" },
  activeBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#EEF2FF", borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: "#C7D2FE",
  },
  activeBadgeText: { fontSize: 10, fontWeight: "700", color: "#4338CA" },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  detailsDivider: { height: 1, backgroundColor: COLORS.border },
  detailChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },

  // Empty state
  empty: { paddingVertical: 60, alignItems: "center", gap: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    width: "100%",
    maxWidth: 860,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: "700", color: COLORS.textPrimary },
  modalScroll: { padding: SPACING.xl },
  formRow: {
    flexDirection: "row",
    gap: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  formCol: { flex: 1 },

  // Form
  fieldLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  fieldHint: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  inputMultiline: { minHeight: 80, paddingTop: SPACING.md },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: "500" },
  chipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + "12" },
  chipTextSelected: { color: COLORS.primary, fontWeight: "700" },
  ingChipSelected: { borderColor: "#6366F1", backgroundColor: "#EEF2FF" },
  ingChipTextSelected: { color: "#4338CA", fontWeight: "700" },

  // Modal footer
  modalFooter: {
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: FONT_SIZE.sm, fontWeight: "600", color: COLORS.textSecondary },
  saveBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
  },
  saveBtnText: { fontSize: FONT_SIZE.sm, fontWeight: "700", color: "#fff" },

});
