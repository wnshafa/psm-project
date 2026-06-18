import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from "../../src/constants/theme";
import { useClientsWithProfiles } from "../../src/hooks/useClientsWithProfiles";
import { db } from "../../src/lib/firebase";
import Toast from "../../src/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  category?: string;
}

interface Step { productId: string; stepName: string; instructions: string; }
interface Routine {
  id: string; clientId: string; type: "Morning" | "Night";
  duration?: string; description?: string; restrictions?: string;
  assignedDate?: any; steps: Step[];
}
interface Template {
  id: string; type: "Morning" | "Night";
  duration?: string; description?: string; steps: Step[];
}

interface PredefinedTemplate {
  id: string; name: string; description: string;
  morningSteps: Step[]; nightSteps: Step[];
  duration: string; restrictions: string;
}

const PREDEFINED_TEMPLATES: PredefinedTemplate[] = [
  {
    id: "post-laser", name: "Post Laser Treatment",
    description: "Gentle recovery routine for post-laser skin",
    duration: "4 Weeks",
    restrictions: "Avoid direct sun exposure. No exfoliating acids. Use only lukewarm water. No makeup for 48 hours.",
    morningSteps: [
      { productId: "", stepName: "Gentle Cleanser", instructions: "Wash with lukewarm water and a gentle, non-foaming cleanser. Pat dry — do not rub." },
      { productId: "", stepName: "Soothing Serum", instructions: "Apply a thin layer of panthenol or centella asiatica serum to calm the skin." },
      { productId: "", stepName: "Physical SPF 50+", instructions: "Apply a thick layer of mineral-based sunscreen. Reapply every 2 hours if outdoors." },
    ],
    nightSteps: [
      { productId: "", stepName: "Gentle Cleanser", instructions: "Double cleanse using an oil-based balm followed by a gentle milk cleanser." },
      { productId: "", stepName: "Barrier Repair Moisturizer", instructions: "Apply a ceramide-rich moisturizer to support skin barrier recovery." },
      { productId: "", stepName: "Healing Ointment", instructions: "Seal with a thin layer of petroleum-free healing ointment on treated areas." },
    ],
  },
  {
    id: "deep-cleansing", name: "Deep Cleansing",
    description: "Thorough pore-cleansing and exfoliation routine",
    duration: "8 Weeks",
    restrictions: "Do not use if skin is irritated or broken. Limit exfoliation to 2-3 times per week.",
    morningSteps: [
      { productId: "", stepName: "Water-Based Cleanser", instructions: "Use a gentle water-based cleanser to remove overnight buildup." },
      { productId: "", stepName: "Vitamin C Serum", instructions: "Apply 2-3 drops of vitamin C serum for antioxidant protection." },
      { productId: "", stepName: "Oil-Free Moisturizer", instructions: "Use a lightweight, oil-free moisturizer to hydrate without clogging pores." },
      { productId: "", stepName: "SPF 30+", instructions: "Finish with a non-comedogenic sunscreen." },
    ],
    nightSteps: [
      { productId: "", stepName: "Oil-Based Cleanser", instructions: "Start with an oil-based cleanser to dissolve sebum and makeup." },
      { productId: "", stepName: "Salicylic Acid Cleanser", instructions: "Follow with a salicylic acid cleanser (2%) focusing on T-zone." },
      { productId: "", stepName: "Clay Mask (2x/week)", instructions: "Apply a thin layer of kaolin clay mask for 10 minutes, twice per week." },
      { productId: "", stepName: "Niacinamide Serum", instructions: "Apply niacinamide 10% serum to regulate oil production." },
      { productId: "", stepName: "Gel Moisturizer", instructions: "Seal with a mattifying gel moisturizer." },
    ],
  },
  {
    id: "acne-treatment", name: "Acne Treatment",
    description: "Targeted routine for acne-prone and congested skin",
    duration: "12 Weeks",
    restrictions: "Avoid picking or squeezing lesions. Discontinue if excessive dryness or peeling occurs. Use only non-comedogenic products.",
    morningSteps: [
      { productId: "", stepName: "Gentle Foaming Cleanser", instructions: "Cleanse with a low-pH foaming cleanser containing salicylic acid." },
      { productId: "", stepName: "Oil-Free Moisturizer", instructions: "Apply a lightweight, oil-free moisturizer with hyaluronic acid." },
      { productId: "", stepName: "SPF 50+ Gel", instructions: "Use an oil-free, matte-finish sunscreen. Reapply midday." },
    ],
    nightSteps: [
      { productId: "", stepName: "Double Cleanse", instructions: "Oil cleanser first, then a benzoyl peroxide or salicylic acid cleanser." },
      { productId: "", stepName: "Treatment Serum", instructions: "Apply a retinoid or azelaic acid serum to active breakouts. Start every other night." },
      { productId: "", stepName: "Non-Comedogenic Moisturizer", instructions: "Use a ceramide-based moisturizer to prevent moisture barrier damage." },
      { productId: "", stepName: "Spot Treatment", instructions: "Apply a sulfur or benzoyl peroxide spot treatment on active lesions only." },
    ],
  },
  {
    id: "hydration-recovery", name: "Hydration Recovery",
    description: "Intensive moisture restoration for dehydrated or damaged skin barrier",
    duration: "4 Weeks",
    restrictions: "Avoid harsh cleansers and exfoliants. Drink at least 8 glasses of water daily. Use a humidifier at night.",
    morningSteps: [
      { productId: "", stepName: "Creamy Non-Foaming Cleanser", instructions: "Use a milk or cream cleanser that does not strip the skin." },
      { productId: "", stepName: "Hyaluronic Acid Serum", instructions: "Apply to damp skin. Layer 2-3 drops and pat gently." },
      { productId: "", stepName: "Barrier Cream", instructions: "Apply a rich moisturizer with ceramides, squalane, and shea butter." },
      { productId: "", stepName: "Hydrating SPF 30+", instructions: "Use a moisturizing sunscreen with added glycerin or hyaluronic acid." },
    ],
    nightSteps: [
      { productId: "", stepName: "Oil Cleanser", instructions: "Use an oil-based cleanser to gently remove impurities without stripping." },
      { productId: "", stepName: "Hydrating Toner", instructions: "Apply a hydrating toner with glycerin and panthenol using a cotton pad." },
      { productId: "", stepName: "Snail Mucin Essence", instructions: "Apply snail mucin essence for deep hydration and repair." },
      { productId: "", stepName: "Sleeping Mask", instructions: "Finish with an overnight hydrating mask or a thick layer of barrier cream." },
    ],
  },
  {
    id: "brightening-treatment", name: "Brightening Treatment",
    description: "Targets hyperpigmentation, dark spots, and uneven skin tone",
    duration: "8 Weeks",
    restrictions: "Strict sun protection required. Avoid other exfoliating acids. Results visible after 4-6 weeks.",
    morningSteps: [
      { productId: "", stepName: "Low-pH Cleanser", instructions: "Cleanse with a low-pH gel cleanser to prep skin for actives." },
      { productId: "", stepName: "Vitamin C Serum (15-20%)", instructions: "Apply on dry skin. Wait 3 minutes before next step." },
      { productId: "", stepName: "Niacinamide Moisturizer", instructions: "Use a moisturizer with 5% niacinamide to boost brightening." },
      { productId: "", stepName: "SPF 50+ PA++++", instructions: "Apply a broad-spectrum sunscreen. Reapply every 2 hours." },
    ],
    nightSteps: [
      { productId: "", stepName: "Oil-Based Cleanser", instructions: "Dissolve sunscreen and impurities with an oil cleanser." },
      { productId: "", stepName: "Gentle Foaming Cleanser", instructions: "Follow with a gentle foaming cleanser." },
      { productId: "", stepName: "Exfoliating Toner (3x/week)", instructions: "Apply glycolic acid (5-7%) toner 3 times per week. Do not rinse." },
      { productId: "", stepName: "Brightening Serum", instructions: "Apply alpha-arbutin or tranexamic acid serum to dark spots." },
      { productId: "", stepName: "Rich Moisturizer", instructions: "Seal with a nourishing night cream containing vitamin E and peptides." },
    ],
  },
];

// ─── Client search modal ──────────────────────────────────────────────────────

function ClientSearchModal({
  visible, clients, onSelect, onClose,
}: { visible: boolean; clients: any[]; onSelect: (c: any) => void; onClose: () => void; }) {
  const [q, setQ] = useState("");
  const filtered = clients.filter((c) =>
    c.fullName?.toLowerCase().includes(q.toLowerCase()) ||
    c.email?.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.clientModal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Select Client</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={COLORS.textSecondary} /></Pressable>
          </View>
          <View style={s.searchRow}>
            <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} />
            <TextInput
              style={s.searchInput} placeholder="Search by name or email..."
              placeholderTextColor={COLORS.textSecondary}
              value={q} onChangeText={setQ} autoFocus
            />
          </View>
          <FlatList
            data={filtered} keyExtractor={(i) => i.id}
            contentContainerStyle={{ gap: 6, padding: 16 }}
            renderItem={({ item }) => (
              <Pressable style={s.clientRow} onPress={() => { onSelect(item); onClose(); }}>
                <View style={s.clientAvatar}>
                  <Text style={s.clientAvatarText}>{item.fullName?.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.clientName}>{item.fullName}</Text>
                  <Text style={s.clientEmail}>{item.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </Pressable>
            )}
            ListEmptyComponent={<Text style={s.emptyText}>No clients found.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const EMPTY_STEPS: Step[] = [{ productId: "", stepName: "", instructions: "" }];

export default function AssignRoutine() {
  const { clients } = useClientsWithProfiles();

  // Left panel
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [existingRoutines, setExistingRoutines] = useState<Routine[]>([]);

  // Right panel / form
  const [activeTab, setActiveTab] = useState<"assign" | "templates">("assign");
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineType, setRoutineType] = useState<"Morning" | "Night">("Morning");
  const [duration, setDuration] = useState("");
  const [steps, setSteps] = useState<Step[]>([...EMPTY_STEPS]);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  // Predefined templates
  const [predefinedModalVisible, setPredefinedModalVisible] = useState(false);
  const [restrictions, setRestrictions] = useState("");

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productPickerIndex, setProductPickerIndex] = useState<number | null>(null);

  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: "" });
  const showToast = (msg: string) => setToast({ visible: true, message: msg });

  // Fetch templates
  useEffect(() => {
    return onSnapshot(collection(db, "routineTemplates"), (snap) => {
      setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Template)));
    });
  }, []);

  // Fetch products
  useEffect(() => {
    setLoadingProducts(true);
    getDocs(collection(db, "products")).then((snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, name: d.data().name, category: d.data().category } as Product)));
    }).catch(() => {}).finally(() => setLoadingProducts(false));
  }, []);

  // Fetch routines when client changes
  useEffect(() => {
    resetForm();
    if (!selectedClient) { setExistingRoutines([]); return; }
    const q = query(collection(db, "routines"), where("clientId", "==", selectedClient.id));
    return onSnapshot(q, (snap) => {
      setExistingRoutines(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Routine)));
    });
  }, [selectedClient]);

  function resetForm() {
    setEditingRoutineId(null);
    setRoutineType("Morning");
    setDuration("");
    setSteps([...EMPTY_STEPS]);
    setRestrictions("");
  }

  function loadForEditing(routine: Routine) {
    setEditingRoutineId(routine.id);
    setRoutineType(routine.type);
    setDuration(routine.duration ?? "");
    setRestrictions(routine.restrictions ?? "");
    setSteps(routine.steps?.length ? routine.steps.map((s) => ({ productId: (s as any).productId ?? "", stepName: (s as any).stepName || (s as any).title || "", instructions: s.instructions })) : [...EMPTY_STEPS]);
    setActiveTab("assign");
  }

  function loadTemplate(t: Template) {
    setRoutineType(t.type);
    setDuration(t.duration ?? "");
    setSteps(t.steps?.length ? t.steps.map((s) => ({ productId: (s as any).productId ?? "", stepName: (s as any).stepName || (s as any).title || "", instructions: s.instructions })) : [...EMPTY_STEPS]);
    setTemplateModalVisible(false);
    setActiveTab("assign");
    showToast("Template loaded.");
  }

  function loadPredefinedTemplate(t: PredefinedTemplate) {
    const stepsForType = routineType === "Morning" ? t.morningSteps : t.nightSteps;
    setDuration(t.duration);
    setRestrictions(t.restrictions);
    setSteps(stepsForType.map((s) => ({ ...s })));
    setPredefinedModalVisible(false);
    showToast(`"${t.name}" template loaded.`);
  }

  const addStep = () => setSteps((prev) => [...prev, { productId: "", stepName: "", instructions: "" }]);
  const removeStep = (i: number) => { if (steps.length > 1) setSteps(steps.filter((_, idx) => idx !== i)); };
  const updateStep = (i: number, key: keyof Step, val: string) => {
    setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  };
  const selectProductForStep = (i: number, product: Product) => {
    setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, productId: product.id, stepName: product.name } : s));
    setProductPickerIndex(null);
  };

  async function handleAssign() {
    if (!selectedClient) { window.alert("Please select a client first."); return; }
    if (!duration.trim()) { window.alert("Please enter a duration."); return; }
    if (!steps[0].stepName.trim()) { window.alert("Please add at least one step with a product."); return; }

    const conflict = existingRoutines.find((r) => r.type === routineType && r.id !== editingRoutineId);
    if (conflict) { window.alert(`A ${routineType} routine already exists for this client. Edit the existing one instead.`); return; }

    setAssigning(true);
    try {
      const payload = {
        clientId: selectedClient.id,
        type: routineType,
        duration: duration.trim(),
        description: `${routineType} Routine (${duration.trim()})`,
        restrictions: restrictions.trim(),
        assignedDate: Timestamp.now(),
        steps: steps.map((s) => ({ productId: s.productId, stepName: s.stepName.trim(), instructions: s.instructions.trim() })),
      };
      if (editingRoutineId) {
        await updateDoc(doc(db, "routines", editingRoutineId), payload);
        showToast("Routine updated.");
        resetForm();
      } else {
        await addDoc(collection(db, "routines"), payload);
        showToast("Routine assigned.");
        setDuration(""); setSteps([...EMPTY_STEPS]);
      }
    } catch (e: any) { window.alert(e.message); }
    finally { setAssigning(false); }
  }

  async function handleDeleteRoutine(id: string) {
    if (!window.confirm("Delete this routine and all its logs?")) return;
    setDeleting(id);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "routines", id));
      const logsSnap = await getDocs(query(collection(db, "routineLogs"), where("routineID", "==", id)));
      logsSnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      if (editingRoutineId === id) resetForm();
      showToast("Routine deleted.");
    } catch (e: any) { window.alert(e.message); }
    finally { setDeleting(null); }
  }

  async function handleSaveTemplate() {
    if (!duration.trim() || !steps[0].stepName.trim()) {
      window.alert("Fill in duration and at least one step before saving as template."); return;
    }
    setSavingTemplate(true);
    try {
      await addDoc(collection(db, "routineTemplates"), {
        type: routineType,
        duration: duration.trim(),
        description: `${routineType} Routine (${duration.trim()})`,
        steps: steps.map((s) => ({ productId: s.productId, stepName: s.stepName.trim(), instructions: s.instructions.trim() })),
        createdAt: Timestamp.now(),
      });
      showToast("Saved to templates.");
    } catch (e: any) { window.alert(e.message); }
    finally { setSavingTemplate(false); }
  }

  async function handleDeleteTemplate(id: string) {
    if (!window.confirm("Delete this template?")) return;
    setDeletingTemplateId(id);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "routineTemplates", id));
      await batch.commit();
      showToast("Template deleted.");
    } catch (e: any) { window.alert(e.message); }
    finally { setDeletingTemplateId(null); }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const morningRoutine = existingRoutines.find((r) => r.type === "Morning");
  const nightRoutine = existingRoutines.find((r) => r.type === "Night");

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.screen}>
      {/* Page header */}
      <View style={s.pageHeader}>
        <View>
          <Text style={s.pageTitle}>Assign Routines</Text>
          <Text style={s.pageSubtitle}>Build and assign skincare routines to clients</Text>
        </View>
      </View>

      {/* 2-panel body */}
      <View style={s.body}>

        {/* ── LEFT PANEL ── */}
        <View style={s.leftPanel}>
          {/* Client selector */}
          <Pressable style={s.clientSelector} onPress={() => setClientModalVisible(true)}>
            {selectedClient ? (
              <View style={s.clientSelectorFilled}>
                <View style={s.clientAvatar}>
                  <Text style={s.clientAvatarText}>{selectedClient.fullName?.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.clientName}>{selectedClient.fullName}</Text>
                  <Text style={s.clientEmail}>{selectedClient.email}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
              </View>
            ) : (
              <View style={s.clientSelectorEmpty}>
                <Ionicons name="person-add-outline" size={20} color={COLORS.textSecondary} />
                <Text style={s.clientSelectorEmptyText}>Select a client</Text>
              </View>
            )}
          </Pressable>

          {/* Morning / Night routine cards */}
          {selectedClient ? (
            <View style={s.routineCards}>
              {/* Morning */}
              <View style={[s.routineTypeCard, { borderColor: "#F59E0B40" }]}>
                <View style={[s.routineTypeCardHeader, { backgroundColor: "#F59E0B" }]}>
                  <Ionicons name="sunny" size={16} color="#fff" />
                  <Text style={s.routineTypeCardTitle}>Morning</Text>
                  {morningRoutine && (
                    <View style={s.assignedBadge}>
                      <Text style={s.assignedBadgeText}>Assigned</Text>
                    </View>
                  )}
                </View>
                {morningRoutine ? (
                  <View style={s.routineTypeCardBody}>
                    <Text style={s.routineCardDuration}>{morningRoutine.duration || "No duration"}</Text>
                    <Text style={s.routineCardSteps}>{morningRoutine.steps?.length ?? 0} steps</Text>
                    <Text style={s.routineCardDate}>
                      Assigned {morningRoutine.assignedDate?.toDate().toLocaleDateString()}
                    </Text>
                    <View style={s.routineCardBtns}>
                      <Pressable style={s.routineCardEditBtn} onPress={() => loadForEditing(morningRoutine)}>
                        <Ionicons name="pencil-outline" size={13} color={COLORS.primary} />
                        <Text style={s.routineCardEditText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={s.routineCardDeleteBtn}
                        onPress={() => handleDeleteRoutine(morningRoutine.id)}
                        disabled={deleting === morningRoutine.id}
                      >
                        {deleting === morningRoutine.id
                          ? <ActivityIndicator size="small" color="#DC2626" />
                          : <Ionicons name="trash-outline" size={13} color="#DC2626" />}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable style={s.routineTypeCardEmpty} onPress={() => { setRoutineType("Morning"); setActiveTab("assign"); }}>
                    <Ionicons name="add-circle-outline" size={20} color="#F59E0B" />
                    <Text style={[s.routineTypeCardEmptyText, { color: "#F59E0B" }]}>Assign Morning</Text>
                  </Pressable>
                )}
              </View>

              {/* Night */}
              <View style={[s.routineTypeCard, { borderColor: "#6366F140" }]}>
                <View style={[s.routineTypeCardHeader, { backgroundColor: "#6366F1" }]}>
                  <Ionicons name="moon" size={16} color="#fff" />
                  <Text style={s.routineTypeCardTitle}>Night</Text>
                  {nightRoutine && (
                    <View style={s.assignedBadge}>
                      <Text style={s.assignedBadgeText}>Assigned</Text>
                    </View>
                  )}
                </View>
                {nightRoutine ? (
                  <View style={s.routineTypeCardBody}>
                    <Text style={s.routineCardDuration}>{nightRoutine.duration || "No duration"}</Text>
                    <Text style={s.routineCardSteps}>{nightRoutine.steps?.length ?? 0} steps</Text>
                    <Text style={s.routineCardDate}>
                      Assigned {nightRoutine.assignedDate?.toDate().toLocaleDateString()}
                    </Text>
                    <View style={s.routineCardBtns}>
                      <Pressable style={s.routineCardEditBtn} onPress={() => loadForEditing(nightRoutine)}>
                        <Ionicons name="pencil-outline" size={13} color={COLORS.primary} />
                        <Text style={s.routineCardEditText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={s.routineCardDeleteBtn}
                        onPress={() => handleDeleteRoutine(nightRoutine.id)}
                        disabled={deleting === nightRoutine.id}
                      >
                        {deleting === nightRoutine.id
                          ? <ActivityIndicator size="small" color="#DC2626" />
                          : <Ionicons name="trash-outline" size={13} color="#DC2626" />}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable style={s.routineTypeCardEmpty} onPress={() => { setRoutineType("Night"); setActiveTab("assign"); }}>
                    <Ionicons name="add-circle-outline" size={20} color="#6366F1" />
                    <Text style={[s.routineTypeCardEmptyText, { color: "#6366F1" }]}>Assign Night</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <View style={s.leftEmpty}>
              <Ionicons name="people-outline" size={40} color={COLORS.border} />
              <Text style={s.leftEmptyText}>Select a client to view and manage their routines</Text>
            </View>
          )}
        </View>

        {/* ── RIGHT PANEL ── */}
        <View style={s.rightPanel}>
          {/* Tabs */}
          <View style={s.tabs}>
            <Pressable
              style={[s.tab, activeTab === "assign" && s.tabActive]}
              onPress={() => setActiveTab("assign")}
            >
              <Ionicons name="clipboard-outline" size={15} color={activeTab === "assign" ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[s.tabText, activeTab === "assign" && s.tabTextActive]}>
                {editingRoutineId ? "Edit Routine" : "Assign Routine"}
              </Text>
            </Pressable>
            <Pressable
              style={[s.tab, activeTab === "templates" && s.tabActive]}
              onPress={() => setActiveTab("templates")}
            >
              <Ionicons name="library-outline" size={15} color={activeTab === "templates" ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[s.tabText, activeTab === "templates" && s.tabTextActive]}>
                Templates ({templates.length})
              </Text>
            </Pressable>
          </View>

          {/* ── Assign tab ── */}
          {activeTab === "assign" && (
            <ScrollView contentContainerStyle={s.formScroll} showsVerticalScrollIndicator={false}>
              {/* Type toggle */}
              <Text style={s.fieldLabel}>Routine Type</Text>
              <View style={s.typeToggle}>
                {(["Morning", "Night"] as const).map((type) => {
                  const color = type === "Morning" ? "#F59E0B" : "#6366F1";
                  const active = routineType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[s.typeBtn, active && { backgroundColor: color, borderColor: color }]}
                      onPress={() => setRoutineType(type)}
                    >
                      <Ionicons name={type === "Morning" ? "sunny" : "moon"} size={16} color={active ? "#fff" : COLORS.textSecondary} />
                      <Text style={[s.typeBtnText, active && { color: "#fff" }]}>{type}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Duration */}
              <Text style={s.fieldLabel}>Duration</Text>
              <View style={s.durationChips}>
                {["2 Weeks", "4 Weeks", "8 Weeks", "3 Months", "Ongoing"].map((preset) => {
                  const active = duration === preset;
                  return (
                    <Pressable
                      key={preset}
                      style={[s.durationChip, active && s.durationChipActive]}
                      onPress={() => setDuration(active ? "" : preset)}
                    >
                      <Text style={[s.durationChipText, active && s.durationChipTextActive]}>{preset}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={[s.input, { marginTop: 8 }]}
                placeholder="Or type custom duration..."
                placeholderTextColor={COLORS.textSecondary}
                value={["2 Weeks", "4 Weeks", "8 Weeks", "3 Months", "Ongoing"].includes(duration) ? "" : duration}
                onChangeText={setDuration}
              />

              {/* Load template shortcut */}
              <Pressable style={s.loadTemplateBtn} onPress={() => setTemplateModalVisible(true)}>
                <Ionicons name="library-outline" size={14} color={COLORS.primary} />
                <Text style={s.loadTemplateBtnText}>Load from Template</Text>
              </Pressable>

              {/* Select Template (predefined) */}
              <Pressable style={s.predefinedTemplateBtn} onPress={() => setPredefinedModalVisible(true)}>
                <Ionicons name="layers-outline" size={14} color={COLORS.primary} />
                <Text style={s.loadTemplateBtnText}>Select Template</Text>
              </Pressable>

              {/* Restrictions */}
              <Text style={s.fieldLabel}>Restrictions</Text>
              <TextInput
                style={[s.input, s.textArea]}
                placeholder="e.g. Avoid sun exposure, no exfoliating acids..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                value={restrictions}
                onChangeText={setRestrictions}
              />

              {/* Steps */}
              <View style={s.stepsHeader}>
                <Text style={s.fieldLabel}>Steps</Text>
                <Pressable style={s.addStepBtn} onPress={addStep}>
                  <Ionicons name="add" size={14} color={COLORS.primary} />
                  <Text style={s.addStepText}>Add Step</Text>
                </Pressable>
              </View>

              {steps.map((step, i) => {
                const selectedProduct = products.find((p) => p.id === step.productId);
                return (
                <View key={i} style={s.stepCard}>
                  <View style={s.stepCardHeader}>
                    <View style={s.stepBadge}>
                      <Text style={s.stepBadgeText}>{i + 1}</Text>
                    </View>
                    {steps.length > 1 && (
                      <Pressable onPress={() => removeStep(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={16} color={COLORS.textSecondary} />
                      </Pressable>
                    )}
                  </View>
                  <Pressable
                    style={[s.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                    onPress={() => setProductPickerIndex(i)}
                  >
                    <Text style={{ color: selectedProduct ? COLORS.textPrimary : COLORS.textSecondary, flex: 1 }}>
                      {selectedProduct ? selectedProduct.name : "Select a product..."}
                    </Text>
                    {loadingProducts ? (
                      <ActivityIndicator size="small" color={COLORS.textSecondary} />
                    ) : (
                      <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                    )}
                  </Pressable>
                  <TextInput
                    style={[s.input, s.textArea]}
                    placeholder="Instructions..."
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    value={step.instructions}
                    onChangeText={(v) => updateStep(i, "instructions", v)}
                  />
                </View>
                );
              })}

              {/* Footer buttons */}
              <View style={s.formFooter}>
                <Pressable style={s.saveTemplateBtn} onPress={handleSaveTemplate} disabled={savingTemplate}>
                  {savingTemplate
                    ? <ActivityIndicator size="small" color={COLORS.primary} />
                    : <><Ionicons name="bookmark-outline" size={14} color={COLORS.primary} /><Text style={s.saveTemplateBtnText}>Save as Template</Text></>
                  }
                </Pressable>

                <View style={s.formActions}>
                  {editingRoutineId && (
                    <Pressable style={s.cancelEditBtn} onPress={resetForm}>
                      <Text style={s.cancelEditBtnText}>Cancel</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[s.assignBtn, assigning && { opacity: 0.7 }]}
                    onPress={handleAssign}
                    disabled={assigning}
                  >
                    {assigning
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <><Ionicons name={editingRoutineId ? "checkmark" : "send"} size={15} color="#fff" />
                          <Text style={s.assignBtnText}>{editingRoutineId ? "Update Routine" : "Assign Routine"}</Text></>
                    }
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          )}

          {/* ── Templates tab ── */}
          {activeTab === "templates" && (
            <ScrollView contentContainerStyle={s.formScroll} showsVerticalScrollIndicator={false}>
              {templates.length === 0 ? (
                <View style={s.templatesEmpty}>
                  <Ionicons name="library-outline" size={40} color={COLORS.border} />
                  <Text style={s.templatesEmptyText}>No templates saved yet.</Text>
                  <Text style={s.templatesEmptyHint}>Build a routine and tap "Save as Template" to reuse it later.</Text>
                </View>
              ) : (
                <View style={s.templateList}>
                  {templates.map((t) => {
                    const color = t.type === "Morning" ? "#F59E0B" : "#6366F1";
                    return (
                      <View key={t.id} style={s.templateCard}>
                        <View style={[s.templateCardAccent, { backgroundColor: color }]} />
                        <View style={s.templateCardBody}>
                          <View style={s.templateCardTop}>
                            <View style={[s.templateTypePill, { backgroundColor: color + "18", borderColor: color + "40" }]}>
                              <Ionicons name={t.type === "Morning" ? "sunny" : "moon"} size={11} color={color} />
                              <Text style={[s.templateTypePillText, { color }]}>{t.type}</Text>
                            </View>
                            <Text style={s.templateDuration}>{t.duration}</Text>
                          </View>
                          <Text style={s.templateDesc}>{t.description}</Text>
                          <Text style={s.templateStepCount}>{t.steps?.length ?? 0} steps</Text>
                          <View style={s.templateActions}>
                            <Pressable style={s.templateLoadBtn} onPress={() => loadTemplate(t)}>
                              <Ionicons name="download-outline" size={13} color={COLORS.primary} />
                              <Text style={s.templateLoadBtnText}>Load</Text>
                            </Pressable>
                            <Pressable
                              style={s.templateDeleteBtn}
                              onPress={() => handleDeleteTemplate(t.id)}
                              disabled={deletingTemplateId === t.id}
                            >
                              {deletingTemplateId === t.id
                                ? <ActivityIndicator size="small" color="#DC2626" />
                                : <Ionicons name="trash-outline" size={13} color="#DC2626" />}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Client search modal */}
      <ClientSearchModal
        visible={clientModalVisible}
        clients={clients}
        onSelect={setSelectedClient}
        onClose={() => setClientModalVisible(false)}
      />

      {/* Template picker modal */}
      <Modal visible={templateModalVisible} transparent animationType="fade" onRequestClose={() => setTemplateModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.templatePickerModal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Load Template</Text>
              <Pressable onPress={() => setTemplateModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            {templates.length === 0 ? (
              <Text style={s.emptyText}>No templates saved.</Text>
            ) : (
              <FlatList
                data={templates}
                keyExtractor={(i) => i.id}
                contentContainerStyle={{ gap: 8, padding: 16 }}
                renderItem={({ item: t }) => {
                  const color = t.type === "Morning" ? "#F59E0B" : "#6366F1";
                  return (
                    <Pressable style={s.optionItem} onPress={() => loadTemplate(t)}>
                      <Ionicons name={t.type === "Morning" ? "sunny" : "moon"} size={16} color={color} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.optionText}>{t.description}</Text>
                        <Text style={[s.clientEmail, { marginTop: 2 }]}>{t.steps?.length ?? 0} steps · {t.duration}</Text>
                      </View>
                      <Ionicons name="download-outline" size={16} color={COLORS.primary} />
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Predefined template picker modal */}
      <Modal visible={predefinedModalVisible} transparent animationType="fade" onRequestClose={() => setPredefinedModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.templatePickerModal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Select Routine Template</Text>
              <Pressable onPress={() => setPredefinedModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            <FlatList
              data={PREDEFINED_TEMPLATES}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ gap: 8, padding: 16 }}
              renderItem={({ item: t }) => (
                <Pressable style={s.optionItem} onPress={() => loadPredefinedTemplate(t)}>
                  <View style={[s.clientAvatar, { backgroundColor: COLORS.primary + "18" }]}>
                    <Ionicons name="layers-outline" size={16} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optionText}>{t.name}</Text>
                    <Text style={[s.clientEmail, { marginTop: 2 }]}>{t.description} · {t.duration}</Text>
                  </View>
                  <Ionicons name="download-outline" size={16} color={COLORS.primary} />
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Product picker modal */}
      <Modal visible={productPickerIndex !== null} transparent animationType="fade" onRequestClose={() => setProductPickerIndex(null)}>
        <View style={s.modalOverlay}>
          <View style={s.templatePickerModal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Select Product</Text>
              <Pressable onPress={() => setProductPickerIndex(null)}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            {loadingProducts ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ margin: 40 }} />
            ) : (
              <FlatList
                data={products}
                keyExtractor={(p) => p.id}
                contentContainerStyle={{ gap: 6, padding: 16 }}
                renderItem={({ item: p }) => (
                  <Pressable style={s.clientRow} onPress={() => {
                    if (productPickerIndex !== null) selectProductForStep(productPickerIndex, p);
                  }}>
                    <View style={[s.clientAvatar, { backgroundColor: COLORS.primary + "18" }]}>
                      <Ionicons name="leaf-outline" size={16} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.clientName}>{p.name}</Text>
                      {p.category ? <Text style={s.clientEmail}>{p.category}</Text> : null}
                    </View>
                    <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={s.emptyText}>No products found.</Text>}
              />
            )}
          </View>
        </View>
      </Modal>

      <Toast message={toast.message} visible={toast.visible} onHide={() => setToast({ visible: false, message: "" })} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },

  pageHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16,
  },
  pageTitle: { fontSize: 28, fontWeight: "800", color: COLORS.textPrimary },
  pageSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontWeight: "500" },

  // 2-panel
  body: { flex: 1, flexDirection: "row", gap: 0 },

  // ── Left panel ──
  leftPanel: {
    width: 280, borderRightWidth: 1, borderRightColor: COLORS.border,
    padding: 16, gap: 16,
  },
  clientSelector: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  clientSelectorFilled: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
  },
  clientSelectorEmpty: {
    flexDirection: "row", alignItems: "center", gap: 8, padding: 14,
    justifyContent: "center",
  },
  clientSelectorEmptyText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  clientAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },
  clientAvatarText: { color: "#fff", fontWeight: "800", fontSize: FONT_SIZE.sm },
  clientName: { fontSize: FONT_SIZE.sm, fontWeight: "700", color: COLORS.textPrimary },
  clientEmail: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },

  routineCards: { gap: 12 },
  routineTypeCard: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, overflow: "hidden",
  },
  routineTypeCardHeader: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  routineTypeCardTitle: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZE.sm, flex: 1 },
  assignedBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
  },
  assignedBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  routineTypeCardBody: { padding: 12, gap: 4 },
  routineCardDuration: { fontSize: FONT_SIZE.sm, fontWeight: "700", color: COLORS.textPrimary },
  routineCardSteps: { fontSize: 11, color: COLORS.textSecondary },
  routineCardDate: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  routineCardBtns: { flexDirection: "row", gap: 8, marginTop: 8 },
  routineCardEditBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 6, borderRadius: 8,
    backgroundColor: COLORS.primary + "12", borderWidth: 1, borderColor: COLORS.primary + "30",
  },
  routineCardEditText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  routineCardDeleteBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center",
  },
  routineTypeCardEmpty: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, padding: 14,
  },
  routineTypeCardEmptyText: { fontSize: FONT_SIZE.sm, fontWeight: "600" },

  leftEmpty: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40,
  },
  leftEmptyText: {
    fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    textAlign: "center", lineHeight: 20,
  },

  // ── Right panel ──
  rightPanel: { flex: 1, flexDirection: "column" },

  tabs: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingHorizontal: 24,
  },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 14, paddingHorizontal: 4, marginRight: 24,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.sm, fontWeight: "600", color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },

  formScroll: { padding: 24, gap: 14 },

  fieldLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: "700", color: COLORS.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5,
  },

  durationChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durationChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  durationChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  durationChipText: { fontSize: FONT_SIZE.xs, fontWeight: "600", color: COLORS.textSecondary },
  durationChipTextActive: { color: "#fff" },

  typeToggle: { flexDirection: "row", gap: 10 },
  typeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 10, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  typeBtnText: { fontSize: FONT_SIZE.sm, fontWeight: "600", color: COLORS.textSecondary },

  input: {
    borderWidth: 1, borderColor: COLORS.border, padding: 12,
    borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.card,
    color: COLORS.textPrimary, fontSize: FONT_SIZE.sm,
  },
  textArea: { height: 72, textAlignVertical: "top", marginTop: 8 },

  loadTemplateBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary + "40",
    backgroundColor: COLORS.primary + "08",
  },
  loadTemplateBtnText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: "600" },
  predefinedTemplateBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary + "40",
    backgroundColor: COLORS.primary + "08",
  },

  stepsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addStepBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary + "40",
    backgroundColor: COLORS.primary + "08",
  },
  addStepText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: "700" },

  stepCard: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: 12, gap: 8,
  },
  stepCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },
  stepBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  formFooter: { gap: 10, marginTop: 8 },
  saveTemplateBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary + "40",
    backgroundColor: COLORS.primary + "08",
  },
  saveTemplateBtnText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: "600" },
  formActions: { flexDirection: "row", gap: 10 },
  cancelEditBtn: {
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: "center",
  },
  cancelEditBtnText: { fontSize: FONT_SIZE.sm, fontWeight: "600", color: COLORS.textSecondary },
  assignBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 12, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  assignBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZE.sm },

  // Templates tab
  templatesEmpty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  templatesEmptyText: { fontSize: FONT_SIZE.sm, fontWeight: "700", color: COLORS.textSecondary },
  templatesEmptyHint: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: "center", lineHeight: 18 },
  templateList: { gap: 12 },
  templateCard: {
    flexDirection: "row", backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  templateCardAccent: { width: 4 },
  templateCardBody: { flex: 1, padding: 12, gap: 4 },
  templateCardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  templateTypePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  templateTypePillText: { fontSize: 11, fontWeight: "700" },
  templateDuration: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500" },
  templateDesc: { fontSize: FONT_SIZE.sm, fontWeight: "700", color: COLORS.textPrimary },
  templateStepCount: { fontSize: 11, color: COLORS.textSecondary },
  templateActions: { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  templateLoadBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.primary + "12", borderWidth: 1, borderColor: COLORS.primary + "30",
  },
  templateLoadBtnText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  templateDeleteBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center",
  },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 40,
  },
  clientModal: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg,
    width: "100%", maxWidth: 480, maxHeight: "80%",
  },
  templatePickerModal: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg,
    width: "100%", maxWidth: 480, maxHeight: "70%",
  },
  modalHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: FONT_SIZE.md, fontWeight: "700", color: COLORS.textPrimary },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 16, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  clientRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  optionItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  optionText: { fontSize: FONT_SIZE.sm, fontWeight: "600", color: COLORS.textPrimary },
  emptyText: { textAlign: "center", color: COLORS.textSecondary, padding: 20 },
});
