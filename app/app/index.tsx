import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './src/constants/theme';
import { auth, db } from './src/lib/firebase';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Personalized Routines',
    description: 'Get skincare steps tailored specifically for your skin type by experts.',
    icon: 'sparkles',
  },
  {
    id: '2',
    title: 'Track Your Progress',
    description: 'Log your daily routine and see the transformation with side-by-side photos.',
    icon: 'trending-up',
  },
  {
    id: '3',
    title: 'Expert Consultation',
    description: 'Stay connected with your consultant through reminders and progress monitoring.',
    icon: 'people',
  },
];

export default function OnboardingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    // Auth logic to skip landing if already logged in
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          router.replace('/(admin)/homePage');
        } else {
          router.replace('/(tabs)/homePage');
        }
      }
    });
    return unsubscribe;
  }, []);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      router.push('/(auth)/login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Progress Dots */}
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View 
              key={index} 
              style={[styles.dot, currentSlide === index && styles.activeDot]} 
            />
          ))}
        </View>

        {/* Carousel Content */}
        <View style={styles.slide}>
          <Text style={styles.title}>{SLIDES[currentSlide].title}</Text>
          <Text style={styles.description}>{SLIDES[currentSlide].description}</Text>
        </View>

        {/* Buttons */}
        <View style={styles.footer}>
          <Pressable style={styles.primaryBtn} onPress={handleNext}>
            <Text style={styles.primaryBtnText}>
              {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </Pressable>
          
          {currentSlide < SLIDES.length - 1 && (
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.skipLink}>Skip</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, padding: 40, justifyContent: 'space-between', alignItems: 'center' },
  pagination: { flexDirection: 'row', marginTop: 40, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  activeDot: { backgroundColor: COLORS.primary, width: 24 },
  slide: { alignItems: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 20 },
  description: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24 },
  footer: { width: '100%', alignItems: 'center', gap: 20, marginBottom: 20 },
  primaryBtn: { backgroundColor: COLORS.primary, width: '100%', paddingVertical: 18, borderRadius: 20, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  skipLink: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },

  screen: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },

  scroll: { 
    padding: 20, 
    gap: 18, 
    paddingBottom: 40 
  },

  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  // HEADER
  header: {
    marginBottom: 10,
  },

  headerTitle: { 
    fontSize: 26, 
    fontWeight: "800", 
    color: COLORS.textPrimary 
  },

  headerSubtitle: { 
    fontSize: 14, 
    color: COLORS.textSecondary,
    marginTop: 4
  },

  // 🔥 RECOMMENDATION CARD
  recommendationSection: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  sectionTitle: { 
    fontSize: 16, 
    fontWeight: "700",
    color: COLORS.textPrimary
  },

  recommendationMessage: { 
    fontSize: 12, 
    marginBottom: 12, 
    color: COLORS.textSecondary 
  },

  productCard: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10
  },

  productTitle: { 
    fontWeight: "600", 
    fontSize: 14,
    color: COLORS.textPrimary
  },

  productDescription: { 
    fontSize: 12, 
    color: COLORS.textSecondary,
    marginTop: 2
  },

  viewAll: { 
    color: COLORS.primary, 
    marginTop: 10,
    fontWeight: "600"
  },

  emptyText: { 
    fontSize: 12, 
    color: COLORS.textSecondary 
  },

  // 🔥 STATS CARD IMPROVED
  statsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    gap: 10
  },

  statCard: { 
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 3
  },

  statValue: { 
    fontSize: 20, 
    fontWeight: "800",
    marginTop: 6,
    color: COLORS.textPrimary
  },

  statLabel: { 
    fontSize: 11,
    color: COLORS.textSecondary
  },

});