import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where
} from "firebase/firestore";
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
  View
} from "react-native";
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING } from '../../src/constants/theme';
import { auth, db } from "../../src/lib/firebase";
import { useClientsWithProfiles } from '../../src/hooks/useClientsWithProfiles';
import { clientPath } from '../../src/constants/firestore';
import Toast from '../../src/components/Toast';

// --- Interfaces ---
interface SearchableSelectProps {
    label: string;
    data: any[];
    selectedItem: any;
    onSelect: (item: any) => void;
    displayKey: string;
    placeholder: string;
}

interface ReminderLog {
    id: string;
    clientName: string;
    templateTitle: string;
    date: Timestamp;
    status: string;
}

// --- Sub-components ---
const SearchableSelect = ({ label, data, selectedItem, onSelect, displayKey, placeholder }: SearchableSelectProps) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [searchText, setSearchText] = useState("");

    const filteredData = data.filter((item) => {
        const val = item[displayKey]?.toLowerCase() || "";
        return val.includes(searchText.toLowerCase());
    });

    return (
        <View style={styles.selectContainer}>
            <Text style={styles.selectLabel}>{label}</Text>
            <Pressable
                style={styles.selectButton}
                onPress={() => { setSearchText(""); setModalVisible(true); }}
            >
                <Text style={[styles.selectButtonText, !selectedItem && { color: COLORS.textSecondary }]}>
                    {selectedItem ? selectedItem[displayKey] || "Unnamed" : placeholder}
                </Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
            </Pressable>

            <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select {label}</Text>
                            <Pressable onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </Pressable>
                        </View>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search..."
                                placeholderTextColor={COLORS.textSecondary}
                                value={searchText}
                                onChangeText={setSearchText}
                                autoFocus
                            />
                        </View>
                        <FlatList
                            data={filteredData}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={[styles.optionItem, selectedItem?.id === item.id && styles.optionSelected]}
                                    onPress={() => { onSelect(item); setModalVisible(false); }}
                                >
                                    <Text style={[styles.optionText, selectedItem?.id === item.id && styles.optionTextSelected]}>
                                        {item[displayKey] || "Unnamed"}
                                    </Text>
                                    {selectedItem?.id === item.id && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                                </Pressable>
                            )}
                            ListEmptyComponent={<Text style={styles.emptyText}>No results found.</Text>}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// --- Main Component ---
export default function AdminReminder() {
    const { clients } = useClientsWithProfiles();
    const [templates, setTemplates] = useState<any[]>([]);
    const [pastReminders, setPastReminders] = useState<ReminderLog[]>([]);
    const [selectedClient, setSelectedClient] = useState<any | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
    const [createTemplateVisible, setCreateTemplateVisible] = useState(false);
    const [newTemplateTitle, setNewTemplateTitle] = useState("");
    const [newTemplateMessage, setNewTemplateMessage] = useState("");
    const [sendMode, setSendMode] = useState<'template' | 'custom'>('template');
    const [customTitle, setCustomTitle] = useState("");
    const [customMessage, setCustomMessage] = useState("");
    const [sendingReminder, setSendingReminder] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: "" });

    const showToast = (message: string) => setToast({ visible: true, message });

    // 1. Fetch Templates
    useEffect(() => {
      const unsub = onSnapshot(collection(db, "reminderTemplate"), (snapshot) => {
          setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
          console.error("Template Listener Error:", error.message);
      });
      return () => unsub();
  }, []);

    // 2. Fetch History
    useEffect(() => {
        let q = selectedClient
            ? query(collection(db, "reminder"), where("clientID", "==", clientPath(selectedClient.id)), orderBy("date", "desc"), limit(15))
            : query(collection(db, "reminder"), orderBy("date", "desc"), limit(10));

        return onSnapshot(q, (snapshot) => {
            setPastReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReminderLog)));
        }, (err) => {
            console.error("Firestore Error: Index might be missing. ", err.message);
        });
    }, [selectedClient]);

    // 3. Send Reminder Logic
    const handleCreateReminder = async () => {
        if (!selectedClient) {
            Alert.alert("Error", "Please select a client.");
            return;
        }
        if (sendMode === 'template' && !selectedTemplate) {
            Alert.alert("Error", "Please select a template.");
            return;
        }
        if (sendMode === 'custom' && (!customTitle.trim() || !customMessage.trim())) {
            Alert.alert("Error", "Please fill in both title and message.");
            return;
        }

        const title = sendMode === 'custom' ? customTitle.trim() : selectedTemplate.title;
        const message = sendMode === 'custom' ? customMessage.trim() : selectedTemplate.message;

        setSendingReminder(true);
        try {
            await addDoc(collection(db, "reminder"), {
                clientID: clientPath(selectedClient.id),
                clientName: selectedClient.name || "Client",
                ...(sendMode === 'template' && { templateID: `/reminderTemplate/${selectedTemplate.id}` }),
                templateTitle: title,
                message,
                userId: auth.currentUser?.uid,
                date: Timestamp.now(),
                status: "unread",
            });

            showToast("Notification sent to client.");
            setSelectedTemplate(null);
            setCustomTitle("");
            setCustomMessage("");
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setSendingReminder(false);
        }
    };

    // 4. Template Creation Logic
    const handleCreateTemplate = async () => {
        if (!newTemplateTitle.trim() || !newTemplateMessage.trim()) {
            return Alert.alert("Error", "Fill in all fields.");
        }
        setSavingTemplate(true);
        try {
            await addDoc(collection(db, "reminderTemplate"), {
                title: newTemplateTitle.trim(),
                message: newTemplateMessage.trim(),
                userId: auth.currentUser?.uid,
                createdAt: Timestamp.now()
            });
            showToast("Template saved.");
            setNewTemplateTitle("");
            setNewTemplateMessage("");
            setCreateTemplateVisible(false);
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setSavingTemplate(false);
        }
    };

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.pageHeader}>
                    <Text style={styles.pageTitle}>Reminders</Text>
                    <Text style={styles.pageSubtitle}>Send notifications to clients</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Send New Notification</Text>

                    <SearchableSelect
                        label="Target Client"
                        data={clients}
                        selectedItem={selectedClient}
                        onSelect={setSelectedClient}
                        displayKey="name"
                        placeholder="Select Client..."
                    />

                    {selectedClient && (
                        <Pressable onPress={() => setSelectedClient(null)} style={{marginTop: 5}}>
                            <Text style={{color: COLORS.primary, fontSize: 12}}>Clear filter / Show all history</Text>
                        </Pressable>
                    )}

                    {/* Mode toggle */}
                    <View style={styles.modeToggle}>
                        <Pressable
                            style={[styles.modeTab, sendMode === 'template' && styles.modeTabActive]}
                            onPress={() => setSendMode('template')}
                        >
                            <Text style={[styles.modeTabText, sendMode === 'template' && styles.modeTabTextActive]}>
                                From Template
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[styles.modeTab, sendMode === 'custom' && styles.modeTabActive]}
                            onPress={() => setSendMode('custom')}
                        >
                            <Text style={[styles.modeTabText, sendMode === 'custom' && styles.modeTabTextActive]}>
                                Custom Message
                            </Text>
                        </Pressable>
                    </View>

                    {sendMode === 'template' ? (
                        <View style={{ marginTop: SPACING.md }}>
                            <SearchableSelect
                                label="Message Template"
                                data={templates}
                                selectedItem={selectedTemplate}
                                onSelect={setSelectedTemplate}
                                displayKey="title"
                                placeholder="Select Template..."
                            />
                            <Pressable onPress={() => setCreateTemplateVisible(true)} style={styles.addTemplateLink}>
                                <Text style={styles.addTemplateText}>+ Create New Template</Text>
                            </Pressable>
                            {selectedTemplate && (
                                <View style={styles.previewCard}>
                                    <Text style={styles.previewLabel}>Preview:</Text>
                                    <Text style={styles.previewText}>&quot;{selectedTemplate.message}&quot;</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Title</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Notification title..."
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={customTitle}
                                    onChangeText={setCustomTitle}
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Message</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    multiline
                                    placeholder="Write your message here..."
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={customMessage}
                                    onChangeText={setCustomMessage}
                                />
                            </View>
                        </View>
                    )}

                    <Pressable
                        style={[styles.createButton, sendingReminder && { opacity: 0.7 }]}
                        onPress={handleCreateReminder}
                        disabled={sendingReminder}
                    >
                        {sendingReminder ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Ionicons name="send" size={18} color="#fff" style={{marginRight: 8}} />
                                <Text style={styles.createButtonText}>Send Notification</Text>
                            </>
                        )}
                    </Pressable>
                </View>

                {/* History Section */}
                <View style={styles.historySection}>
                    <Text style={styles.sectionTitle}>
                        {selectedClient ? `History: ${selectedClient.name}` : "Recent Activity"}
                    </Text>
                    {pastReminders.length === 0 ? (
                        <Text style={styles.emptyText}>No reminders found.</Text>
                    ) : (
                        pastReminders.map((item) => (
                            <View key={item.id} style={styles.historyItem}>
                                <View style={styles.historyIcon}>
                                    <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.historyClient}>{item.clientName}</Text>
                                    <Text style={styles.historyMsg}>{item.templateTitle}</Text>
                                </View>
                                <Text style={styles.historyDate}>
                                    {item.date?.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </Text>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Template Creation Modal */}
            <Modal visible={createTemplateVisible} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: 'auto', paddingBottom: 40 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Template</Text>
                            <Pressable onPress={() => setCreateTemplateVisible(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                            </Pressable>
                        </View>
                        <TextInput
                            style={[styles.input, { marginBottom: SPACING.md }]}
                            placeholder="Title"
                            value={newTemplateTitle}
                            onChangeText={setNewTemplateTitle}
                            placeholderTextColor={COLORS.textSecondary}
                        />
                        <TextInput
                            style={[styles.input, styles.textArea, { marginBottom: SPACING.md }]}
                            multiline
                            placeholder="Message"
                            value={newTemplateMessage}
                            onChangeText={setNewTemplateMessage}
                            placeholderTextColor={COLORS.textSecondary}
                        />
                        <Pressable
                            style={[styles.createButton, savingTemplate && { opacity: 0.7 }]}
                            onPress={handleCreateTemplate}
                            disabled={savingTemplate}
                        >
                            {savingTemplate ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.createButtonText}>Save Template</Text>
                            )}
                        </Pressable>
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

// --- Styles ---
const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    scroll: { padding: 24 },
    pageHeader: { marginBottom: SPACING.xl },
    pageTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
    pageSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
    card: { backgroundColor: COLORS.card, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
    sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
    selectContainer: { gap: SPACING.sm },
    selectLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: "600" },
    selectButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.inputBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
    selectButtonText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
    addTemplateLink: { alignSelf: 'flex-end', marginTop: 8 },
    addTemplateText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
    previewCard: { backgroundColor: COLORS.inputBackground, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.md, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
    previewLabel: { color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
    previewText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, fontStyle: 'italic' },
    createButton: { backgroundColor: COLORS.primary, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md, alignItems: "center", marginTop: SPACING.lg, flexDirection: 'row', justifyContent: 'center' },
    createButtonText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZE.md },
    historySection: { marginTop: SPACING.xxl },
    historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    historyIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.inputBackground, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
    historyClient: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.textPrimary },
    historyMsg: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
    historyDate: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: BORDER_RADIUS.lg, borderTopRightRadius: BORDER_RADIUS.lg, height: "70%", padding: SPACING.lg },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md },
    modalTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: "bold" },
    searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.inputBackground, paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
    searchInput: { flex: 1, paddingVertical: SPACING.md, color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
    listContent: { paddingBottom: SPACING.xl },
    optionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    optionSelected: { backgroundColor: COLORS.inputBackground, paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.sm },
    optionText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
    optionTextSelected: { color: COLORS.primary, fontWeight: "bold" },
    emptyText: { color: COLORS.textSecondary, textAlign: "center", marginTop: SPACING.xl },
    input: { borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.inputBackground, color: COLORS.textPrimary },
    textArea: { height: 100, textAlignVertical: 'top' },
    inputGroup: { gap: 4 },
    inputLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
    modeToggle: { flexDirection: 'row', backgroundColor: COLORS.inputBackground, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.lg, padding: 3, gap: 3 },
    modeTab: { flex: 1, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.sm - 1, alignItems: 'center' },
    modeTabActive: { backgroundColor: COLORS.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
    modeTabText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
    modeTabTextActive: { color: COLORS.primary },
});
