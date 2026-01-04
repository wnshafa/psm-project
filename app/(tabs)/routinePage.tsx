import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  DocumentData,
  DocumentSnapshot,
  onSnapshot,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { auth, db } from "../src/lib/firebase";
import { COLORS } from "../src/constants/theme";

const defaultSteps = [
  { title: "Cleanser", detail: "Hydrating gel", duration: "1 min" },
  { title: "Essence", detail: "Layer moisture", duration: "1 min" },
  { title: "Serum", detail: "Vitamin C boost", duration: "2 min" },
  { title: "Moisturizer", detail: "Barrier support", duration: "1 min" },
  { title: "SPF", detail: "Broad spectrum", duration: "30 sec" },
];

export default function RoutinePage() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [steps, setSteps] = useState(defaultSteps);
  const [streak, setStreak] = useState(0);
  const [routineName, setRoutineName] = useState("Morning glow routine");
  const hasTriggeredComplete = useRef(false);

  // 1. Listen for User Data (Streak & Assigned Steps)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap: DocumentSnapshot<DocumentData>) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data?.streak !== undefined) setStreak(data.streak);
              if (data?.routineName) setRoutineName(data.routineName);
              if (data?.steps) setSteps(data.steps);
            }
          });
        return () => unsubscribeDoc();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const progress = useMemo(() => {
    const done = completed.length;
    const total = steps.length || 1;
    return Math.round((done / total) * 100);
  }, [completed, steps]);

  // 2. Logging Logic when Routine is Finished
  const handleComplete = useCallback(async () => {
    if (hasTriggeredComplete.current) return;
    hasTriggeredComplete.current = true;
    
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      // Update User Streak
      await updateDoc(doc(db, 'users', user.uid), {
          streak: streak + 1
      });

      // Create Entry in routineLogs Collection
      // We use a reference to the 'routines' collection as seen in your DB
      await addDoc(collection(db, 'routineLogs'), {
        logDate: Timestamp.now(), 
        status: "completed",
        // We use a placeholder ID; in production, fetch the user's active routine ID
        routineID: doc(db, 'routines', 'routineID_placeholder') 
      });

      Alert.alert("Congratulations!", "Routine logged and streak updated!");
    } catch (e) {
        console.error("Logging Error:", e);
    }
  }, [streak]);

  useEffect(() => {
    if (progress === 100 && steps.length > 0) {
      handleComplete();
    } else if (progress < 100) {
      hasTriggeredComplete.current = false;
    }
  }, [progress, handleComplete, steps.length]);

  const toggleStep = (title: string) => {
    setCompleted((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.logo}>PrestigeMy</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Day {streak} streak</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Routine</Text>
          <Text style={styles.heroTitle}>{routineName}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}% Complete</Text>
        </View>

        <View style={styles.stepList}>
          {steps.map((step, idx) => {
            const isDone = completed.includes(step.title);
            return (
              <Pressable
                key={idx}
                style={[styles.stepRow, isDone && styles.stepRowDone]}
                onPress={() => toggleStep(step.title)}
              >
                <View style={[styles.check, isDone && styles.checkActive]}>
                  <Text style={styles.checkText}>{isDone ? "✓" : idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, isDone && styles.textDone]}>{step.title}</Text>
                  <Text style={styles.stepDetail}>{step.detail}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 24, gap: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { color: COLORS.textPrimary, fontWeight: "700", letterSpacing: 2 },
  badge: { backgroundColor: COLORS.card, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  badgeText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: "700" },
  heroCard: { backgroundColor: COLORS.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  heroLabel: { color: COLORS.textSecondary, fontSize: 12, textTransform: "uppercase", fontWeight: "700" },
  heroTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "700" },
  progressTrack: { height: 10, backgroundColor: COLORS.inputBackground, borderRadius: 5, marginTop: 10 },
  progressFill: { height: "100%", backgroundColor: COLORS.primary, borderRadius: 5 },
  progressText: { color: COLORS.textSecondary, fontSize: 12, textAlign: "right" },
  stepList: { gap: 12 },
  stepRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, padding: 15, borderRadius: 15, gap: 15, borderWidth: 1, borderColor: COLORS.border },
  stepRowDone: { opacity: 0.6 },
  check: { width: 30, height: 30, backgroundColor: COLORS.primary, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  checkActive: { backgroundColor: COLORS.textPrimary },
  checkText: { color: COLORS.background, fontWeight: "700" },
  stepTitle: { color: COLORS.textPrimary, fontWeight: "700", fontSize: 16 },
  textDone: { textDecorationLine: "line-through", color: COLORS.textSecondary },
  stepDetail: { color: COLORS.textSecondary, fontSize: 13 }
});