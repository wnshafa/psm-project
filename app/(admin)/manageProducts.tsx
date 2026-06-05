import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type SkinType = "Normal" | "Dry" | "Oily" | "Combination" | "Sensitive";
type SkinConcern =
  | "Acne"
  | "Aging"
  | "Dryness"
  | "Oiliness"
  | "Sensitivity"
  | "Brightening";

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  skinType: SkinType;
  skinConcern: SkinConcern[];
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

const SKIN_TYPES: SkinType[] = [
  "Normal",
  "Dry",
  "Oily",
  "Combination",
  "Sensitive",
];

const SKIN_CONCERNS: SkinConcern[] = [
  "Acne",
  "Aging",
  "Dryness",
  "Oiliness",
  "Sensitivity",
  "Brightening",
];

const EMPTY_FORM = {
  name: "",
  category: "",
  description: "",
  skinType: "" as SkinType | "",
  skinConcern: [] as SkinConcern[],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManageProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Real-time listener
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const data: Product[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Product, "id">),
      }));
      setProducts(data);
    });
    return unsubscribe;
  }, []);

  // Filtered list
  const filtered = products.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function openModal() {
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
  }

  function toggleConcern(concern: SkinConcern) {
    setForm((prev) => ({
      ...prev,
      skinConcern: prev.skinConcern.includes(concern)
        ? prev.skinConcern.filter((c) => c !== concern)
        : [...prev.skinConcern, concern],
    }));
  }

  async function handleAdd() {
    if (!form.name.trim() || !form.category.trim() || !form.skinType) {
      Alert.alert("Missing fields", "Name, category, and skin type are required.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "products"), {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        skinType: form.skinType,
        skinConcern: form.skinConcern,
      });
      closeModal();
    } catch (e) {
      Alert.alert("Error", "Failed to add product. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(product: Product) {
    Alert.alert(
      "Delete Product",
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "products", product.id));
            } catch {
              Alert.alert("Error", "Failed to delete product.");
            }
          },
        },
      ]
    );
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderProduct({ item }: { item: Product }) {
    const isExpanded = expandedId === item.id;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => toggleExpand(item.id)}
        style={styles.card}
      >
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.productName} numberOfLines={isExpanded ? undefined : 1}>
              {item.name}
            </Text>
            <Text style={styles.productCategory}>{item.category}</Text>
          </View>
          <View style={styles.cardActions}>
            <Text style={styles.chevron}>{isExpanded ? "▲" : "▼"}</Text>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Skin Type</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.skinType}</Text>
              </View>
            </View>

            {item.skinConcern?.length > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Concerns</Text>
                <View style={styles.tagRow}>
                  {item.skinConcern.map((c) => (
                    <View key={c} style={styles.tag}>
                      <Text style={styles.tagText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!!item.description && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailValue}>{item.description}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Product Catalog</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openModal}>
          <Text style={styles.addBtnText}>+ Add Product</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by product name..."
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Count */}
      <Text style={styles.countText}>
        {filtered.length} {filtered.length === 1 ? "product" : "products"}
      </Text>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No products found.</Text>
          </View>
        }
      />

      {/* ── Add Product Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScroll}
            >
              {/* Modal header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Product</Text>
                <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Name */}
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Hydrating Toner"
                placeholderTextColor={COLORS.textSecondary}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />

              {/* Category */}
              <Text style={styles.fieldLabel}>Category *</Text>
              <View style={styles.optionGrid}>
                {CATEGORIES.map((cat) => {
                  const selected = form.category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.optionChip, selected && styles.optionChipSelected]}
                      onPress={() => setForm((f) => ({ ...f, category: cat }))}
                    >
                      <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Description */}
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Product description..."
                placeholderTextColor={COLORS.textSecondary}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Skin Type (single select) */}
              <Text style={styles.fieldLabel}>Skin Type *</Text>
              <View style={styles.optionGrid}>
                {SKIN_TYPES.map((st) => {
                  const selected = form.skinType === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.optionChip, selected && styles.optionChipSelected]}
                      onPress={() => setForm((f) => ({ ...f, skinType: st }))}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          selected && styles.optionChipTextSelected,
                        ]}
                      >
                        {st}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Skin Concern (multi-select) */}
              <Text style={styles.fieldLabel}>Skin Concerns</Text>
              <View style={styles.optionGrid}>
                {SKIN_CONCERNS.map((sc) => {
                  const selected = form.skinConcern.includes(sc);
                  return (
                    <TouchableOpacity
                      key={sc}
                      style={[styles.optionChip, selected && styles.optionChipSelected]}
                      onPress={() => toggleConcern(sc)}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          selected && styles.optionChipTextSelected,
                        ]}
                      >
                        {sc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Actions */}
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleAdd}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? "Saving..." : "Add Product"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Page header
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  pageTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  addBtnText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: FONT_SIZE.sm,
  },

  // Search
  searchContainer: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },

  // Count
  countText: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },

  // List
  list: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.lg,
  },
  cardHeaderText: {
    flex: 1,
    marginRight: SPACING.md,
  },
  productName: {
    fontSize: FONT_SIZE.md,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  chevron: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.danger,
    fontWeight: "700",
  },

  // Card expanded details
  cardDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  detailBlock: {
    gap: 4,
  },
  detailLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginRight: SPACING.sm,
  },
  detailValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },

  // Badge / tags
  badge: {
    backgroundColor: "#FFF0F5",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: "600",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  tag: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },

  // Empty
  empty: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    maxHeight: "90%",
  },
  modalScroll: {
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xl,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  modalClose: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: "700",
  },

  // Form fields
  fieldLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
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
  inputMultiline: {
    minHeight: 80,
    paddingTop: SPACING.md,
  },

  // Option chips (skin type / concern)
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  optionChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  optionChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#FFF0F5",
  },
  optionChipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  optionChipTextSelected: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  // Modal footer actions
  modalFooter: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "700",
    color: COLORS.white,
  },
});
