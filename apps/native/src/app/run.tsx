import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MetricCard } from '@/features/run/components/metric-card';
import { RunMap } from '@/features/run/components/run-map';
import { formatDuration, formatPace, selectElapsedMs } from '@/features/run/domain/run-session';
import { useRunTracker } from '@/features/run/hooks/use-run-tracker';
import { palette, radius, spacing } from '@/theme/tokens';

const KEEP_AWAKE_TAG = 'bodyfuel-active-run';

export default function RunScreen() {
  const tracker = useRunTracker();
  const { session } = tracker;
  const elapsedMs = selectElapsedMs(session, tracker.nowMs);

  useEffect(() => {
    if (session.status === 'running') {
      void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      return () => {
        void deactivateKeepAwake(KEEP_AWAKE_TAG);
      };
    }
    void deactivateKeepAwake(KEEP_AWAKE_TAG);
  }, [session.status]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusRow}>
          <View style={[styles.liveDot, session.status === 'running' && styles.liveDotActive]} />
          <Text style={styles.statusText}>{statusLabel(session.status)}</Text>
          <Text style={styles.permissionText}>
            {tracker.permission === 'granted' ? 'GPS erlaubt' : 'GPS noch nicht erlaubt'}
          </Text>
        </View>

        <RunMap points={session.points} />

        <View style={styles.metrics}>
          <MetricCard label="Zeit" value={formatDuration(elapsedMs)} accent="primary" />
          <MetricCard label="Distanz" value={(session.distanceMeters / 1000).toFixed(2)} unit="km" />
          <MetricCard label="Ø Pace" value={formatPace(session.averagePaceSecondsPerKm)} unit="/km" />
          <MetricCard
            label="Herzfrequenz"
            value={session.heartRateBpm?.toString() ?? '––'}
            unit="bpm"
            accent="danger"
          />
        </View>

        {tracker.error ? <Text style={styles.error}>{tracker.error}</Text> : null}
        {session.rejectedPointCount > 0 ? (
          <Text style={styles.qualityNote}>
            {session.rejectedPointCount} ungenaue GPS-Punkte wurden automatisch verworfen.
          </Text>
        ) : null}

        <View style={styles.controls}>
          {session.status === 'idle' ? (
            <RunButton label="Lauf starten" tone="primary" onPress={() => void tracker.start()} />
          ) : null}
          {session.status === 'running' ? (
            <>
              <RunButton label="Pause" tone="secondary" onPress={tracker.pause} />
              <RunButton label="Beenden" tone="danger" onPress={tracker.finish} />
            </>
          ) : null}
          {session.status === 'paused' ? (
            <>
              <RunButton label="Fortsetzen" tone="primary" onPress={() => void tracker.resume()} />
              <RunButton label="Beenden" tone="danger" onPress={tracker.finish} />
            </>
          ) : null}
          {session.status === 'completed' ? (
            <>
              <View style={styles.completedCard}>
                <Text style={styles.completedTitle}>Lauf lokal gespeichert</Text>
                <Text style={styles.completedCopy}>
                  Der Abschluss bleibt auch nach einem Neustart im lokalen Verlauf erhalten. Der sichere Supabase-Sync folgt nach dem Datenbank-Review.
                </Text>
              </View>
              <RunButton
                label="Zur Übersicht"
                tone="primary"
                onPress={() => {
                  tracker.reset();
                  router.back();
                }}
              />
            </>
          ) : null}
        </View>

        <Text style={styles.prototypeNote}>
          Techniktest: Die iPhone-Aufzeichnung läuft in dieser Stufe im Vordergrund. Dauerbetrieb bei gesperrtem Display wird über die Watch-Workout-Session geprüft.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function statusLabel(status: 'idle' | 'running' | 'paused' | 'completed') {
  if (status === 'running') return 'Lauf aktiv';
  if (status === 'paused') return 'Pausiert';
  if (status === 'completed') return 'Abgeschlossen';
  return 'Bereit';
}

function RunButton({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'primary' | 'secondary' | 'danger';
  onPress: () => void;
}) {
  const backgroundColor =
    tone === 'primary' ? palette.primary : tone === 'danger' ? '#421B1E' : palette.surfaceRaised;
  const textColor = tone === 'primary' ? palette.background : tone === 'danger' ? palette.danger : palette.text;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.controlButton, { backgroundColor }, pressed && styles.pressed]}>
      <Text style={[styles.controlButtonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  statusRow: { marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: palette.textMuted },
  liveDotActive: { backgroundColor: palette.primary },
  statusText: { color: palette.text, fontWeight: '800' },
  permissionText: { marginLeft: 'auto', color: palette.textMuted, fontSize: 12 },
  metrics: { marginTop: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  error: { marginTop: spacing.lg, borderRadius: radius.md, backgroundColor: '#421B1E', padding: spacing.md, color: palette.danger, lineHeight: 20 },
  qualityNote: { marginTop: spacing.md, color: palette.warning, fontSize: 12, lineHeight: 18 },
  controls: { marginTop: spacing.xl, gap: spacing.md },
  controlButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: palette.border },
  controlButtonText: { fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  completedCard: { borderWidth: 1, borderColor: palette.primaryMuted, borderRadius: radius.md, backgroundColor: palette.surface, padding: spacing.lg },
  completedTitle: { color: palette.primary, fontSize: 18, fontWeight: '800' },
  completedCopy: { marginTop: spacing.sm, color: palette.textMuted, lineHeight: 20 },
  prototypeNote: { marginTop: spacing.xl, color: palette.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
