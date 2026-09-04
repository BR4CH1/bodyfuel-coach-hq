import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/theme/tokens';

type MetricCardProps = {
  label: string;
  value: string;
  unit?: string;
  accent?: 'primary' | 'danger' | 'neutral';
};

export function MetricCard({ label, value, unit, accent = 'neutral' }: MetricCardProps) {
  const accentColor =
    accent === 'primary' ? palette.primary : accent === 'danger' ? palette.danger : palette.text;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 145,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  label: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  valueRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  value: {
    fontSize: 30,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  unit: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
