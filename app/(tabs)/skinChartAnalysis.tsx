import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/theme';
import { auth, db } from '../../src/lib/firebase';

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY ?? '';

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
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);
  const [scanDate, setScanDate] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    return onSnapshot(
      query(collection(db, 'skinLogs'), where('clientId', '==', user.uid), orderBy('date', 'desc')),
      (snap) => {
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setHistory(logs);
      }
    );
  }, []);

  const clearHistory = () => {
    Alert.alert('Clear History', 'Delete all scan history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive', onPress: async () => {
          await Promise.all(history.map(log => deleteDoc(doc(db, 'skinLogs', log.id))));
        },
      },
    ]);
  };

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
      setScannedImage(result.assets[0].uri);
      setPendingBase64(result.assets[0].base64);
      setMetrics(null);
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

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          temperature: 0.1,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
              { type: 'text', text: prompt },
            ],
          }],
        }),
      });

      const data = await response.json();
      console.log('Claude response:', JSON.stringify(data, null, 2));
      const text = data.content?.[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Please upload a clear photo of your face for skin analysis.');

      const scores = JSON.parse(jsonMatch[0]);

      const newMetrics = METRIC_CONFIG.map(m => ({
        ...m,
        value: Math.min(100, Math.max(0, Math.round(scores[m.label.toLowerCase()] ?? 50))),
      }));
      setMetrics(newMetrics);
      setPendingBase64(null);

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
      console.warn('Analysis error:', err?.message ?? err);
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
          <Pressable onPress={() => setShowHistory(true)} style={styles.scanBtn}>
            <Ionicons name="time-outline" size={16} color="#fff" />
            <Text style={styles.scanBtnText}>History</Text>
          </Pressable>
        </View>

        {/* Loading */}
        {isAnalyzing && (
          <>
            {scannedImage && (
              <View style={styles.previewCard}>
                <Image source={{ uri: scannedImage }} style={styles.previewImage} />
                <View style={styles.previewOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.previewTitle}>Analyzing your skin...</Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* No scan yet — no image selected */}
        {!isAnalyzing && !metrics && !scannedImage && (
          <>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="camera-outline" size={36} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>Scan Your Skin</Text>
              <Text style={styles.emptySubtitle}>Take a photo or pick from gallery to get your AI skin report</Text>
              <Text style={styles.emptySubtitle}>Disclaimer: This analysis is for informational purposes only and does not replace professional dermatological advice.</Text>
            </View>
            <View style={styles.emptyButtons}>
              <Pressable style={styles.emptyBtn} onPress={openCamera}>
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Take Photo</Text>
              </Pressable>
              <Pressable style={[styles.emptyBtn, styles.emptyBtnOutline]} onPress={openLibrary}>
                <Ionicons name="images-outline" size={16} color={COLORS.primary} />
                <Text style={[styles.emptyBtnText, styles.emptyBtnOutlineText]}>Photo Library</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Image selected — pending analysis */}
        {!isAnalyzing && !metrics && scannedImage && pendingBase64 && (
          <>
            <View style={styles.previewCard}>
              <Image source={{ uri: scannedImage }} style={styles.previewImage} />
              <Pressable
                style={styles.removeImageBtn}
                onPress={() => { setScannedImage(null); setPendingBase64(null); }}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
              <View style={styles.previewOverlay}>
                <Text style={styles.previewTitle}>Ready to Analyze</Text>
                <Pressable onPress={() => { setScannedImage(null); setPendingBase64(null); }} style={styles.retakeBtn}>
                  <Ionicons name="refresh" size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.retakeBtnText}>Retake</Text>
                </Pressable>
              </View>
            </View>
            <Pressable style={styles.analyzeBtn} onPress={() => analyzeImage(pendingBase64, scannedImage)}>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.analyzeBtnText}>Analyze My Skin</Text>
            </Pressable>
          </>
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

          </>
        )}

      </ScrollView>

      {/* History Modal */}
      <Modal visible={showHistory} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowHistory(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Scan History</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {history.length > 0 && (
                <Pressable onPress={clearHistory} style={styles.modalClearBtn}>
                  <Ionicons name="trash-outline" size={15} color="#ff6b6b" />
                  <Text style={styles.modalClearText}>Clear</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setShowHistory(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {history.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="time-outline" size={40} color={COLORS.textSecondary} />
                <Text style={styles.modalEmptyText}>No scan history yet</Text>
              </View>
            ) : (
              history.map((log: any, i) => {
                const d = log.date?.toDate();
                const dateStr = d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                return (
                  <View key={log.id} style={[styles.historyRow, i < history.length - 1 && styles.historyRowBorder]}>
                    <View style={styles.historyDateCol}>
                      <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.historyDate}>{dateStr}</Text>
                    </View>
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
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
  emptyButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  emptyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  emptyBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyBtnOutlineText: { color: COLORS.primary },
  analyzeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 20 },
  analyzeBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Image card (result view)
  imageCard: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  scannedImage: { width: 110, height: 130 },
  imageMeta: { flex: 1, padding: 14, justifyContent: 'center', gap: 6 },
  imageTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  imageDate: { fontSize: 12, color: COLORS.textSecondary },
  rescanBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rescanText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  // Preview card (before analysis)
  previewCard: { borderRadius: 20, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: 320 },
  removeImageBtn: { position: 'absolute', top: 12, left: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  previewOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: 'rgba(0,0,0,0.35)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  retakeBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

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

  // History rows (used inside modal)
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12, paddingHorizontal: 20 },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  historyDateCol: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 90 },
  historyDate: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  historyScores: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  historyScore: { alignItems: 'center', gap: 3, flex: 1 },
  historyScoreVal: { fontSize: 13, fontWeight: '800' },
  historyMiniTrack: { width: 32, height: 4, backgroundColor: COLORS.inputBackground, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  historyMiniFill: { height: '100%', borderRadius: 2 },
  historyScoreLabel: { fontSize: 8, color: COLORS.textSecondary, fontWeight: '700', letterSpacing: 0.5 },

  // Modal
  modalScreen: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.inputBackground, alignItems: 'center', justifyContent: 'center' },
  modalClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,107,107,0.1)' },
  modalClearText: { fontSize: 13, fontWeight: '700', color: '#ff6b6b' },
  modalScroll: { paddingBottom: 40 },
  modalEmpty: { alignItems: 'center', gap: 12, paddingTop: 80 },
  modalEmptyText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
});
