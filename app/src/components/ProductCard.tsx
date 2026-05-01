import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { COLORS } from '../constants/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductCardProps = {
  id: string
  title: string
  description: string
  category?: string
  isSaved?: boolean
  onSave?: (id: string) => void
  onPress?: (id: string) => void
}

// ─── Category Badge Colors ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  cleanser:     { bg: '#e0f7fa', text: '#00796b' },
  moisturizer:  { bg: '#fce4ec', text: '#c2185b' },
  serum:        { bg: '#ede7f6', text: '#512da8' },
  sunscreen:    { bg: '#fff8e1', text: '#f57f17' },
  toner:        { bg: '#e8f5e9', text: '#2e7d32' },
  default:      { bg: '#f3f4f6', text: '#6b7280' },
}

function getCategoryStyle(category?: string) {
  if (!category) return CATEGORY_COLORS.default
  return CATEGORY_COLORS[category.toLowerCase()] ?? CATEGORY_COLORS.default
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductCard({
  id,
  title,
  description,
  category,
  isSaved = false,
  onSave,
  onPress,
}: ProductCardProps) {
  const catStyle = getCategoryStyle(category)

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(id)}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* ── Top Row: Title + Save Icon ── */}
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          {/* Category Badge */}
          {category && (
            <View style={[styles.badge, { backgroundColor: catStyle.bg }]}>
              <Text style={[styles.badgeText, { color: catStyle.text }]}>
                {category}
              </Text>
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
        </View>

        {/* Save / Bookmark Icon */}
        {onSave && (
          <TouchableOpacity
            onPress={() => onSave(id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.saveButton}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isSaved ? COLORS.primary : '#aaa'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Description ── */}
      <Text style={styles.description}>{description}</Text>
    </TouchableOpacity>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  titleContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  saveButton: {
    paddingLeft: 10,
    paddingTop: 2,
  },
})