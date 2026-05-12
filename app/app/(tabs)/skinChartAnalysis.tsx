import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { COLORS } from "../src/constants/theme";

// 🛑 WARNING: For testing only! Never leave API keys in a published mobile app.
// Later, you should move this API call to a Firebase Cloud Function.
const GEMINI_API_KEY = "AIzaSyDU7q2JoSbmwrCcS0Jrnwv9M_Uy3njLCzo"; 

export type SkinMetric = {
  label: string;
  value: number;
  color?: string;
}

const DEFAULT_METRICS: SkinMetric[] = [
  { label: 'Hydration', value: 50, color: '#4ecdc4' },
  { label: 'Oiliness', value: 50, color: '#ff6b6b' },
  { label: 'Sensitivity', value: 50, color: '#f7b731' },
  { label: 'Brightness', value: 50, color: '#a29bfe' },
];

function getScoreLabel(value: number) {
  if (value >= 75) return { label: 'High', color: '#51cf66' };
  if (value >= 50) return { label: 'Moderate', color: '#f7b731' };
  return { label: 'Low', color: '#ff6b6b' };
}

export default function SkinAnalysisChart() {
  const [metrics, setMetrics] = useState<SkinMetric[]>(DEFAULT_METRICS);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);

  // 1. Pick Image & Convert to Base64
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Please grant camera access to scan your skin.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.5, // Compress image to save bandwidth
      base64: true, // IMPORTANT: We need base64 to send to Gemini
    });

    if (!result.canceled && result.assets[0].base64) {
      setScannedImage(result.assets[0].uri);
      analyzeSkinWithGemini(result.assets[0].base64);
    }
  };

  // 2. Call Gemini Vision API
  const analyzeSkinWithGemini = async (base64Image: string) => {
    setIsAnalyzing(true);
    
    try {
      const prompt = `
        You are an expert dermatologist. Analyze this face and assess the skin condition.
        Return ONLY a JSON object with four keys: "hydration", "oiliness", "sensitivity", and "brightness".
        The values must be integers between 0 and 100 representing the score.
        Do not include any other text or formatting.
      `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inlineData: {         // ✅ FIXED: Must be camelCase
                    mimeType: "image/jpeg", // ✅ FIXED: Must be camelCase
                    data: base64Image
                  }
                }
              ]
            }]
          })
        }
      );

      const data = await response.json();

      // ✅ ADDED: Catch API Key errors or Google Server errors and print them
      if (!response.ok || data.error) {
        console.error("❌ Gemini API Error:", JSON.stringify(data.error, null, 2));
        Alert.alert("API Error", data.error?.message || "Check your console for details.");
        setIsAnalyzing(false);
        return;
      }

      // Extract the text response from Gemini
      let rawText = data.candidates[0].content.parts[0].text;
      
      // Clean up the string just in case Gemini wraps it in ```json ... ```
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const aiScores = JSON.parse(rawText);

      // 3. Update the UI Metrics
      setMetrics([
        { label: 'Hydration', value: aiScores.hydration || 50, color: '#4ecdc4' },
        { label: 'Oiliness', value: aiScores.oiliness || 50, color: '#ff6b6b' },
        { label: 'Sensitivity', value: aiScores.sensitivity || 50, color: '#f7b731' },
        { label: 'Brightness', value: aiScores.brightness || 50, color: '#a29bfe' },
      ]);

    } catch (error) {
      console.error("❌ General Error:", error);
      Alert.alert("Analysis Failed", "Could not parse the AI response. Try taking the photo again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

     

  // Generate dynamic insight based on actual scores
  const getDynamicInsight = () => {
    const hydration = metrics.find(m => m.label === 'Hydration')?.value || 50;
    const oiliness = metrics.find(m => m.label === 'Oiliness')?.value || 50;
    const sensitivity = metrics.find(m => m.label === 'Sensitivity')?.value || 50;

    let text = "";
    if (hydration < 50) text += "Your skin is showing low hydration levels. Focus on hyaluronic acid and rich moisturizers. ";
    else text += "Your hydration levels look great! Keep up your water intake. ";

    if (oiliness > 75) text += "\n\nHigh oiliness detected. Consider using a gentle foaming cleanser and niacinamide. ";
    if (sensitivity > 75) text += "\n\nYour skin is highly sensitive right now. Avoid harsh exfoliants and stick to ceramides.";

    return text;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Skin Analysis</Text>
          <Text style={styles.headerSubtitle}>Evaluate your skin with AI Vision</Text>
        </View>

        <View style={styles.container}>
          <View style={styles.chartHeaderRow}>
            <Text style={styles.title}>Current Profile</Text>
            
            <Pressable onPress={pickImage} style={styles.retakeBtn} disabled={isAnalyzing}>
              <Ionicons name="camera" size={16} color={COLORS.primary} />
              <Text style={styles.retakeBtnText}>AI Face Scan</Text>
            </Pressable>
          </View>

          {isAnalyzing ? (
             <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Analyzing your skin with Gemini...</Text>
             </View>
          ) : (
            <>
              {scannedImage && (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: scannedImage }} style={styles.scannedImage} />
                  <Text style={styles.imageLabel}>Last Scanned Image</Text>
                </View>
              )}

              <View style={styles.chartArea}>
                {metrics.map((metric) => {
                  const score = getScoreLabel(metric.value);
                  const barColor = metric.color ?? COLORS.primary;

                  return (
                    <View key={metric.label} style={styles.row}>
                      <Text style={styles.label}>{metric.label}</Text>
                      <View style={styles.trackBackground}>
                        <View
                          style={[
                            styles.trackFill,
                            { flex: metric.value / 100, backgroundColor: barColor },
                          ]}
                        />
                        <View style={{ flex: 1 - metric.value / 100 }} />
                      </View>
                      <View style={styles.valueContainer}>
                        <Text style={styles.value}>{metric.value}%</Text>
                        <Text style={[styles.scoreLabel, { color: score.color }]}>
                          {score.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#51cf66' }]} />
                  <Text style={styles.legendText}>High ≥75%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#f7b731' }]} />
                  <Text style={styles.legendText}>Moderate ≥50%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#ff6b6b' }]} />
                  <Text style={styles.legendText}>Low &lt;50%</Text>
                </View>
              </View>
            </  >
          )}
        </View>

        {/* Dynamic Insights */}
        {!isAnalyzing && (
          <View style={styles.card}>
            <Text style={styles.insightTitle}>Skin Insight</Text>
            <Text style={styles.insightText}>{getDynamicInsight()}</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  header: { marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: 14, color: COLORS.textSecondary },

  // Cards
  container: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginTop: 10 },
  
  // Loading State
  loadingBox: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, color: COLORS.textSecondary, fontWeight: '600' },

  // Image Preview
  imagePreviewContainer: { alignItems: 'center', marginBottom: 20 },
  scannedImage: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: COLORS.primary },
  imageLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 6, fontWeight: '600' },

  // Chart Styles
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212, 165, 116, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  retakeBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  chartArea: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 80, fontSize: 12, color: COLORS.textSecondary },
  trackBackground: { flex: 1, flexDirection: 'row', height: 10, backgroundColor: '#f0f0f0', borderRadius: 20, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 20, minWidth: 6 },
  valueContainer: { width: 70, alignItems: 'flex-end' },
  value: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  scoreLabel: { fontSize: 10, fontWeight: '600' },
  
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 24, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: COLORS.textSecondary },

  insightTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8, color: COLORS.textPrimary },
  insightText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, lineHeight: 20 },
});