import { router } from 'expo-router';
import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../src/constants/theme';

export default function ClientDashboard() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSubtitle}>Track your skincare progress</Text>
      </View>

      {/* Progress Summary Card */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Your Progress</Text>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Routines Completed</Text>
          <Text style={styles.progressValue}>12</Text>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Current Streak</Text>
          <Text style={styles.progressValue}>5 days</Text>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Last Routine</Text>
          <Text style={styles.progressValue}>Yesterday</Text>
        </View>
      </View>

      {/* Primary Action: View Progress */}
      <Pressable
        style={styles.primaryActionBox}
        onPress={() => router.push('/(tabs)/userProfile')}
      >
        <View style={styles.iconPlaceholder} />
        <Text style={styles.actionTextPrimary}>View Progress</Text>
      </Pressable>

      {/* Secondary Action: Log Routine */}
      <Pressable
        style={styles.secondaryActionBox}
        onPress={() => router.push('/(tabs)/routinePage')}
      >
        <View style={[styles.iconPlaceholder, { borderColor: COLORS.textSecondary }]} />
        <Text style={styles.actionTextSecondary}>Log Daily Routine</Text>
      </Pressable>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },

  header: {
    paddingVertical: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },

  /* Progress Card */
  progressCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  progressTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
  progressValue: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },

  /* Action Buttons */
  primaryActionBox: {
    backgroundColor: COLORS.card,
    height: 150,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  secondaryActionBox: {
    backgroundColor: 'transparent',
    height: 150,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: COLORS.textPrimary,
    borderRadius: 20,
  },
  actionTextPrimary: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    fontSize: FONT_SIZE.md,
  },
  actionTextSecondary: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    fontSize: FONT_SIZE.md,
  },
});
