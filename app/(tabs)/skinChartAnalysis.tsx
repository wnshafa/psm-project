import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/theme';
import { auth, db } from '../../src/lib/firebase';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

type SkinMetric = { label: string; value: number; color: string; icon: string };

const METRIC_CONFIG = [
  { label: 'Hydration',   color: '#4ecdc4', icon: 'water-outline' },
  { label: 'Oiliness',    color: '#ff6b6b', icon: 'sunny-outline' },
  { label: 'Sensitivity', color: '#f7b731', icon: 'alert-circle-outline' },
  { label: 'Brightness',  color: '#a29bfe', icon: 'sparkles-outline' },
];

function getScoreLabel(value: number) {
  if (value >= 75) return { label: 'High',     color: '#51cf66', bg: 'rgba(81,207,102,0.12)' };
  if (value >= 50) return { label: 'Moderate', color: '#f7b731', bg: 'rgba(247,183,49,0.12)' };
  return               { label: 'Low',      color: '#ff6b6b', bg: 'rgba(255,107,107,0.12)' };
}

const getDynamicInsight = (metrics: SkinMetric[]) => {
  const h = metrics.find(m => m.label === 'Hydration')?.value ?? 50;
  const o = metrics.find(m => m.label === 'Oiliness')?.value ?? 50;
  const s = metrics.find(m => m.label === 'Sensitivity')?.value ?? 50;
  const b = metrics.find(m => m.label === 'Brightness')?.value ?? 50;

  const insights: string[] = [];
  if (h < 50)  insights.push('Low hydration detected — try hyaluronic acid and drink more water.');
  else         insights.push('Hydration looks good! Maintain your current moisturizing routine.');
  if (o > 75)  insights.push('High oiliness — consider a gentle foaming cleanser and niacinamide serum.');
  if (s > 75)  insights.push('Skin is highly sensitive — avoid harsh exfoliants, stick to ceramides.');
  if (b < 50)  insights.push('Brightness is low — look into vitamin C serums and consistent SPF use.');
  return insights;
};

export default function SkinAnalysisPage() {
  const [metrics, setMetrics] = useState<SkinMetric[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [scanDate, setScanDate] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    return onSnapshot(
      query(collection(db, 'skinLogs'), where('clientId', '==', user.uid), orderBy('date', 'desc')),
      (snap) => {
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setHistory(logs);
        if (logs.length > 0) {
          const latest = logs[0] as any;
          setMetrics(METRIC_CONFIG.map(m => ({
            ...m,
            value: latest[m.label.toLowerCase()] ?? 50,
          })));
          setScannedImage(latest.imageUrl || null);
          const d = latest.date?.toDate();
          if (d) setScanDate(d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
        }
      }
    );
  }, []);

  const IMAGE_OPTIONS = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [3, 4] as [number, number],
    quality: 0.5,
    base64: true,
  };

  const handlePickImage = () => {
    Alert.alert('Scan Skin', 'Choose image source', [
      { text: 'Camera',       onPress: openCamera },
      { text: 'Photo Library', onPress: openLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openCamera = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) { Alert.alert('Permission Required', 'Please grant camera access.'); return; }
    handleResult(await ImagePicker.launchCameraAsync(IMAGE_OPTIONS));
  };

  const openLibrary = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Permission Required', 'Please grant photo library access.'); return; }
    handleResult(await ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS));
  };

  const handleResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets[0].base64) {
      const uri = result.assets[0].uri;
      setScannedImage(uri);
      analyzeImage(result.assets[0].base64, uri);
    }
  };

  const analyzeImage = async (base64Image: string, imageUri: string) => {
    setIsAnalyzing(true);
    try {
      const prompt = `You are a professional skin analysis AI. Analyze this facial skin photo and return ONLY a valid JSON object with these 4 scores (integers from 0 to 100):
{
  "hydration": <how hydrated the skin looks, 100 = very plump/dewy, 0 = very dry/flaky>,
  "oiliness": <how oily the skin looks, 100 = very shiny/oily, 0 = completely matte>,
  "sensitivity": <signs of sensitivity like redness/irritation, 100 = very red/irritated, 0 = calm>,
  "brightness": <overall skin radiance, 100 = very bright/glowing, 0 = dull/uneven>
}
Return ONLY the JSON. No explanation, no markdown.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
              ],
            }],
            generationConfig: { temperature: 0.1 },
          }),
        }
      );

      const data = await response.json();
      console.log('Gemini response:', JSON.stringify(data, null, 2));
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const scores = JSON.parse(jsonMatch[0]);

      const newMetrics = METRIC_CONFIG.map(m => ({
        ...m,
        value: Math.min(100, Math.max(0, Math.round(scores[m.label.toLowerCase()] ?? 50))),
      }));
      setMetrics(newMetrics);

      const now = new Date();
      setScanDate(now.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));

      const user = auth.currentUser;
      if (user) {
        await addDoc(collection(db, 'skinLogs'), {
          clientId: user.uid,
          date: Timestamp.now(),
          imageUrl: imageUri,
          hydration:   newMetrics[0].value,
          oiliness:    newMetrics[1].value,
          sensitivity: newMetrics[2].value,
          brightness:  newMetrics[3].value,
        });
      }
    } catch (err: any) {
      console.error('Analysis error:', err?.message ?? err);
      Alert.alert('Analysis Failed', err?.message ?? 'Could not analyse the image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const insights = metrics ? getDynamicInsight(metrics) : [];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Skin Analysis</Text>
          <Pressable onPress={handlePickImage} style={styles.scanBtn} disabled={isAnalyzing}>
            <Ionicons name="camera" size={16} color="#fff" />
            <Text style={styles.scanBtnText}>Scan</Text>
          </Pressable>
        </View>

        {/* Loading */}
        {isAnalyzing && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Analyzing your skin...</Text>
          </View>
        )}

        {/* No scan yet */}
        {!isAnalyzing && !metrics && (
          <Pressable style={styles.emptyCard} onPress={handlePickImage}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="camera-outline" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>Scan Your Skin</Text>
            <Text style={styles.emptySubtitle}>Take a photo or pick from gallery to get your AI skin report</Text>
            <View style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Get Started</Text>
            </View>
          </Pressable>
        )}

        {/* Result */}
        {!isAnalyzing && metrics && (
          <>
            {/* Scanned Image + Date */}
            {scannedImage && (
              <View style={styles.imageCard}>
                <Image source={{ uri: scannedImage }} style={styles.scannedImage} />
                <Pressable
                  style={styles.removeImageBtn}
                  onPress={() => { setScannedImage(null); setMetrics(null); setScanDate(null); }}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
                <View style={styles.imageMeta}>
                  <Text style={styles.imageTitle}>Latest Scan</Text>
                  {scanDate && <Text style={styles.imageDate}>{scanDate}</Text>}
                  <Pressable onPress={handlePickImage} style={styles.rescanBtn}>
                    <Ionicons name="refresh" size={14} color={COLORS.primary} />
                    <Text style={styles.rescanText}>Rescan</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* 2x2 Metric Grid */}
            <View style={styles.metricsGrid}>
              {metrics.map((m) => {
                const score = getScoreLabel(m.value);
                return (
                  <View key={m.label} style={styles.metricCard}>
                    <View style={styles.metricTop}>
                      <View style={[styles.metricIconBg, { backgroundColor: `${m.color}20` }]}>
                        <Ionicons name={m.icon as any} size={18} color={m.color} />
                      </View>
                      <View style={[styles.scorePill, { backgroundColor: score.bg }]}>
                        <Text style={[styles.scorePillText, { color: score.color }]}>{score.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.metricValue}>{m.value}%</Text>
                    <Text style={styles.metricLabel}>{m.label}</Text>
                    <View style={styles.metricTrack}>
                      <View style={[styles.metricFill, { flex: m.value / 100, backgroundColor: m.color }]} />
                      <View style={{ flex: 1 - m.value / 100 }} />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Skin Insight */}
            <View style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Ionicons name="bulb-outline" size={18} color={COLORS.primary} />
                <Text style={styles.insightTitle}>Skin Insight</Text>
              </View>
              {insights.map((tip, i) => (
                <View key={i} style={styles.insightRow}>
                  <View style={styles.insightDot} />
                  <Text style={styles.insightText}>{tip}</Text>
                </View>
              ))}
            </View>

            {/* Scan History */}
            {history.length > 1 && (
              <View style={styles.historyCard}>
                <Text style={styles.historyTitle}>Scan History</Text>
                {history.slice(1, 4).map((log: any, i) => {
                  const d = log.date?.toDate();
                  const dateStr = d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                  return (
                    <View key={log.id} style={[styles.historyRow, i < Math.min(history.length - 2, 2) && styles.historyRowBorder]}>
                      {/* Date */}
                      <View style={styles.historyDateCol}>
                        <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
                        <Text style={styles.historyDate}>{dateStr}</Text>
                      </View>
                      {/* Scores */}
                      <View style={styles.historyScores}>
                        {METRIC_CONFIG.map(m => {
                          const val = log[m.label.toLowerCase()] ?? 0;
                          return (
                            <View key={m.label} style={styles.historyScore}>
                              <Text style={[styles.historyScoreVal, { color: m.color }]}>{val}%</Text>
                              <View style={styles.historyMiniTrack}>
                                <View style={[styles.historyMiniFill, { flex: val / 100, backgroundColor: m.color }]} />
                                <View style={{ flex: 1 - val / 100 }} />
                              </View>
                              <Text style={styles.historyScoreLabel}>{m.label.slice(0, 3).toUpperCase()}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Loading
  loadingCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 40, alignItems: 'center', gap: 14, borderWidth: 1, borderColor: COLORS.border },
  loadingText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },

  // Empty state
  emptyCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 32, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.border },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(212,165,116,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  emptySubtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 8, backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Image card
  imageCard: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  removeImageBtn: { position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  scannedImage: { width: 110, height: 130 },
  imageMeta: { flex: 1, padding: 14, justifyContent: 'center', gap: 6 },
  imageTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  imageDate: { fontSize: 12, color: COLORS.textSecondary },
  rescanBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rescanText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  // Metrics 2x2 grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: '47%', backgroundColor: COLORS.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricIconBg: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  scorePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  scorePillText: { fontSize: 10, fontWeight: '700' },
  metricValue: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary },
  metricLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  metricTrack: { flexDirection: 'row', height: 6, backgroundColor: COLORS.inputBackground, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  metricFill: { height: '100%', borderRadius: 3, minWidth: 4 },

  // Insight
  insightCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  insightRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  insightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 6 },
  insightText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },

  // History
  historyCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  historyTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  historyDateCol: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 },
  historyDate: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  historyScores: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  historyScore: { alignItems: 'center', gap: 3, flex: 1 },
  historyScoreVal: { fontSize: 13, fontWeight: '800' },
  historyMiniTrack: { width: 32, height: 4, backgroundColor: COLORS.inputBackground, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  historyMiniFill: { height: '100%', borderRadius: 2 },
  historyScoreLabel: { fontSize: 8, color: COLORS.textSecondary, fontWeight: '700', letterSpacing: 0.5 },
});
