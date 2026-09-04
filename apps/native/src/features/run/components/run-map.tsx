import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/theme/tokens';
import type { LocationPoint } from '../domain/run-session';

export function RunMap({ points }: { points: LocationPoint[] }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.eyebrow}>ROUTE</Text>
      <Text style={styles.title}>{points.length ? `${points.length} GPS-Punkte` : 'Warte auf GPS …'}</Text>
      <Text style={styles.copy}>Die Kartenansicht steht auf iPhone und Android zur Verfügung.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 230,
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.xl,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    marginTop: spacing.sm,
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  copy: {
    marginTop: spacing.sm,
    color: palette.textMuted,
    lineHeight: 20,
  },
});
