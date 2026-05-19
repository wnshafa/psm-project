import { Ionicons } from "@expo/vector-icons";
// At the top of routinePage.tsx
import {
    addDoc,
    collection,
    doc,
    getDocs,
    increment,
    onSnapshot,
    query,
    Timestamp,
    updateDoc,
    where,
    writeBatch
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../src/constants/theme";
import { auth, db } from "../../src/lib/firebase";

const isTimeValid = (type: string) => {
    const hour = new Date().getHours();
    if (type === 'Morning') return hour >= 5 && hour <= 12;
    if (type === 'Night') return hour >= 18 || hour <= 3;
    return true; 
};

export default function DisplayRoutine() {
    const [routines, setRoutines] = useState<any[]>([]);
    const [clientData, setClientData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isLogging, setIsLogging] = useState(false);
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [notes, setNotes] = useState("");
    const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
    const [completedRoutineIds, setCompletedRoutineIds] = useState<string[]>([]);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(collection(db, 'routines'), where('clientId', '==', user.uid));
        const unsubRoutines = onSnapshot(q, (snapshot) => {
            setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        const unsubClient = onSnapshot(doc(db, 'clients', user.uid), (doc) => {
            if (doc.exists()) setClientData(doc.data());
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const logQuery = query(
            collection(db, 'routineLogs'), 
            where('clientId', '==', user.uid),
            where('logDate', '>=', Timestamp.fromDate(today))
        );
        const unsubLogs = onSnapshot(logQuery, (snapshot) => {
            setCompletedRoutineIds(snapshot.docs.map(doc => doc.data().routineID));
        });

        return () => { unsubRoutines(); unsubClient(); unsubLogs(); };
    }, []);

    const handleLogCompletion = async (routine: any) => {
        const user = auth.currentUser;
        if (!user || isLogging) return; //
    
        // 1. Check if this specific routine has already been logged today
        const today = new Date();
        today.setHours(0, 0, 0, 0); //
    
        try {
            const checkQuery = query(
                collection(db, 'routineLogs'),
                where('clientId', '==', user.uid), //
                where('routineID', '==', routine.id), // Matches your field name
                where('logDate', '>=', Timestamp.fromDate(today)) //
            );
    
            const checkSnap = await getDocs(checkQuery); //
    
            if (!checkSnap.empty) {
                Alert.alert(
                    "Already Logged", 
                    `You have already completed your ${routine.type} routine for today!`
                );
                return;
            }
    
            // 2. Original Validations (Time & Mood)
            if (!isTimeValid(routine.type)) { //
                Alert.alert("Locked", `It's too early/late for your ${routine.type} routine.`); //
                return;
            }
            if (!selectedMood) { //
                Alert.alert("Skin Status", "Select a mood to unlock the log."); //
                return;
            }
    
            setIsLogging(true); //
    
            // 3. Calculate and Store (Your existing logic with adherence)
            const totalAssigned = routines.length; //
            const totalCompletedToday = completedRoutineIds.length + 1; 
            const currentAdherence = Math.round((totalCompletedToday / totalAssigned) * 100);
    
            await addDoc(collection(db, 'routineLogs'), {
                clientId: user.uid, //
                routineID: routine.id, //
                type: routine.type, //
                status: "completed", //
                mood: selectedMood, //
                notes: notes, //
                adherenceAtLog: currentAdherence,
                logDate: Timestamp.now(), //
            });
    
            // Update Client Profile
            await updateDoc(doc(db, 'clients', user.uid), {
                streak: increment(1), //
                dailyAdherence: currentAdherence,
                lastUpdated: Timestamp.now() //
            });
    
            // Dismiss all unread reminders when routine is completed
            const remindersSnap = await getDocs(query(
                collection(db, 'reminder'),
                where('clientID', '==', `/clients/${user.uid}`),
                where('status', '==', 'unread')
            ));
            if (!remindersSnap.empty) {
                const batch = writeBatch(db);
                remindersSnap.docs.forEach(d => batch.update(d.ref, { status: 'read' }));
                await batch.commit();
            }

            Alert.alert("Success!", "Your routine is logged for today."); //
            
        } catch (error: any) {
            Alert.alert("Error", error.message); //
        } finally {
            setIsLogging(false); //
        }
    };

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.headerContainer}>
                    <View>
                        <Text style={styles.headerTitle}>Daily Journal</Text>
                    </View>
                    <View style={styles.streakBadge}>
                        <Ionicons name="flame" size={18} color={COLORS.primary} />
                        <Text style={styles.streakText}>{clientData?.streak || 0}</Text>
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator color={COLORS.primary} size="large" />
                ) : (
                    <View style={styles.list}>
                        {routines.map((routine) => {
                            const isFocused = activeRoutineId === routine.id;
                            const isTimeLocked = !isTimeValid(routine.type);
                            const isCompleted = completedRoutineIds.includes(routine.id);

                            return (
                                <View key={routine.id} style={[styles.card, isFocused && styles.cardFocused, isTimeLocked && !isCompleted && styles.cardLocked]}>
                                    <Pressable onPress={() => (!isTimeLocked || isCompleted) && setActiveRoutineId(isFocused ? null : routine.id)} style={styles.cardHeader}>
                                        <View style={[styles.typeBadge, (isTimeLocked && !isCompleted) ? {backgroundColor: COLORS.border} : isCompleted ? {backgroundColor: '#4ade80'} : {}]}>
                                            <Ionicons name={isCompleted ? "checkmark-circle" : (isTimeLocked ? "lock-closed" : (routine.type === 'Morning' ? 'sunny' : 'moon'))} size={14} color={COLORS.white} />
                                            <Text style={styles.typeText}>{routine.type} {(isTimeLocked && !isCompleted) ? "(Locked)" : isCompleted ? "(Done)" : ""}</Text>
                                        </View>
                                        {(!isTimeLocked || isCompleted) && <Ionicons name={isFocused ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSecondary} />}
                                    </Pressable>
                                    
                                    <Text style={[styles.cardTitle, (isTimeLocked && !isCompleted) && {color: COLORS.border}]}>{routine.description}</Text>

                                    {isFocused && (!isTimeLocked || isCompleted) && (
                                        <View>
                                            <View style={styles.stepContainer}>
                                                {routine.steps?.map((step: any, index: number) => (
                                                    <View key={index} style={styles.itemRow}>
                                                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
                                                        <View style={styles.stepInfo}>
                                                            <Text style={styles.itemTitle}>{step.title}</Text>
                                                            <Text style={styles.itemSubtitle}>{step.instructions}</Text>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                            <View style={styles.divider} />
                                            {!isCompleted && (
                                                <>
                                                    <Text style={styles.moodTitle}>Current Skin Status</Text>
                                                    <View style={styles.moodGrid}>
                                                        {['Happy', 'Stressed', 'Tired', 'Energetic'].map((mood) => (
                                                            <Pressable 
                                                                key={mood} 
                                                                style={[styles.moodItem, selectedMood === mood && { borderColor: COLORS.primary, backgroundColor: COLORS.inputBackground }]} 
                                                                onPress={() => setSelectedMood(mood)}
                                                            >
                                                                <Ionicons 
                                                                    name={mood === 'Happy' ? 'happy' : mood === 'Stressed' ? 'thunderstorm' : mood === 'Tired' ? 'battery-dead' : 'flash'} 
                                                                    size={24} 
                                                                    color={selectedMood === mood ? COLORS.primary : COLORS.textSecondary} 
                                                                />
                                                                <Text style={[styles.moodText, selectedMood === mood && { color: COLORS.primary }]}>{mood}</Text>
                                                            </Pressable>
                                                        ))}
                                                    </View>
                                                    <TextInput
                                                        style={styles.notesInput}
                                                        placeholder="How does your skin feel today?"
                                                        placeholderTextColor={COLORS.textSecondary}
                                                        multiline
                                                        value={notes}
                                                        onChangeText={setNotes}
                                                    />
                                                </>
                                            )}
                                            <Pressable 
                                                style={[styles.primaryButton, (!selectedMood || isLogging || isCompleted) && styles.buttonDisabled, isCompleted && {backgroundColor: '#4ade80', opacity: 1}]}
                                                onPress={() => handleLogCompletion(routine)}
                                                disabled={isLogging || (!selectedMood && !isCompleted) || isCompleted}
                                            >
                                                <Text style={styles.primaryText}>{isCompleted ? "Routine Completed" : "Unlock Glow Streak"}</Text>
                                            </Pressable>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    scroll: { padding: 20 },
    headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    headerSubtitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
    headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
    streakBadge: { backgroundColor: COLORS.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary },
    streakText: { color: COLORS.primary, fontWeight: '900', fontSize: 16 },
    list: { gap: 15 },
    card: { backgroundColor: COLORS.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: COLORS.border },
    cardFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.inputBackground },
    cardLocked: { opacity: 0.6, backgroundColor: COLORS.inputBackground },
    typeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
    typeText: { color: COLORS.white, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
    cardTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary, marginTop: 10 },
    primaryButton: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 18, alignItems: "center", marginTop: 10 },
    buttonDisabled: { backgroundColor: COLORS.border, opacity: 0.5 },
    primaryText: { color: COLORS.white, fontWeight: "900", fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
    stepContainer: { marginTop: 15, gap: 12 },
    itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    stepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
    stepNumberText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
    stepInfo: { flex: 1 },
    itemTitle: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
    itemSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    moodTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12, textAlign: 'center' },
    moodGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    moodItem: { alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, width: '23%' },
    moodText: { fontSize: 10, fontWeight: 'bold', marginTop: 5, color: COLORS.textSecondary },
    notesInput: {
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 16,
        padding: 15,
        color: COLORS.textPrimary,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 20
    }
});