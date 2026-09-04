import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/features/auth/session-provider';
import { formatDuration, formatPace, type RunSession } from '@/features/run/domain/run-session';
import {
  loadCompletedRuns,
  subscribeToRunHistory,
} from '@/features/run/services/run-draft';
import { palette, radius, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const session = useSession();

  if (session.loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  if (session.configured && !session.user) return <LoginScreen />;
  return <RunHome localMode={!session.configured} />;
}

function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : 'Login fehlgeschlagen.';
      setError(/invalid login credentials/i.test(raw) ? 'E-Mail oder Passwort ist falsch.' : raw);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
          <Image source={require('@/assets/images/bodyfuel-icon.png')} style={styles.logo} />
          <Text style={styles.brand}>BODYFUEL</Text>
          <Text style={styles.brandSubline}>NATIVE · RUN</Text>

          <View style={styles.loginCard}>
            <Text style={styles.cardTitle}>Willkommen zurück</Text>
            <Text style={styles.cardCopy}>Nutze deinen bestehenden BodyFuel-Zugang.</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              placeholder="E-Mail"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              secureTextEntry
              placeholder="Passwort"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
              onSubmitEditing={() => void submit()}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <PrimaryButton
              label={busy ? 'Wird angemeldet …' : 'Einloggen'}
              disabled={busy || !email.trim() || !password}
              onPress={() => void submit()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RunHome({ localMode }: { localMode: boolean }) {
  const { user, signOut } = useSession();
  const [locationGranted, setLocationGranted] = useState(false);
  const [recentRun, setRecentRun] = useState<RunSession | null>(null);

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then((result) => setLocationGranted(result.granted));
  }, []);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void loadCompletedRuns().then((runs) => {
        if (mounted) setRecentRun(runs[0] ?? null);
      });
    };
    refresh();
    const unsubscribe = subscribeToRunHistory(refresh);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.homeContent}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('@/assets/images/bodyfuel-icon.png')} style={styles.headerLogo} />
            <View>
              <Text style={styles.headerBrand}>BODYFUEL</Text>
              <Text style={styles.headerSubline}>NATIVE · RUN</Text>
            </View>
          </View>
          {user ? (
            <Pressable onPress={() => void signOut()} hitSlop={12}>
              <Text style={styles.logout}>Abmelden</Text>
            </Pressable>
          ) : null}
        </View>

        {localMode ? (
          <View style={styles.localBanner}>
            <Text style={styles.localBannerTitle}>Lokaler Technikmodus</Text>
            <Text style={styles.localBannerCopy}>
              GPS kann getestet werden. Cloud-Sync und Login werden aktiv, sobald die Supabase-Werte im Build hinterlegt sind.
            </Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>DEIN NÄCHSTER LAUF</Text>
          <Text style={styles.heroTitle}>Bereit für deinen Lauf?</Text>
          <Text style={styles.heroCopy}>
            Strecke, Pace und Zeit werden direkt in BodyFuel aufgezeichnet.
          </Text>
          <View style={styles.statusRow}>
            <StatusPill
              label={locationGranted ? 'GPS freigegeben' : 'GPS beim Start freigeben'}
              active={locationGranted}
            />
            <StatusPill label="Watch vorbereitet" active={false} />
          </View>
          <PrimaryButton label="Freien Lauf starten" onPress={() => router.push('/run')} />
        </View>

        {recentRun ? <RecentRunCard run={recentRun} /> : null}

        <Text style={styles.sectionTitle}>Laufsteuerung</Text>
        <View style={styles.featureGrid}>
          <FeatureCard title="Tempo" text="Zielbereich und Warnungen sind im Laufkern vorbereitet." />
          <FeatureCard title="Herzfrequenz" text="Live-Werte kommen im Watch-Build direkt aus HealthKit." />
          <FeatureCard title="Route" text="GPS-Spur ist aktiv; geplante Navigation folgt nach dem Hardwaretest." />
          <FeatureCard title="Speicherung" text="Abgebrochene Läufe werden lokal als pausierter Entwurf gerettet." />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled && styles.primaryButtonPressed,
        disabled && styles.disabled,
      ]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={styles.statusPill}>
      <View style={[styles.statusDot, { backgroundColor: active ? palette.primary : palette.warning }]} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.featureCard}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function RecentRunCard({ run }: { run: RunSession }) {
  return (
    <View style={styles.recentRunCard}>
      <View>
        <Text style={styles.eyebrow}>LETZTER LAUF</Text>
        <Text style={styles.recentRunDistance}>{(run.distanceMeters / 1000).toFixed(2)} km</Text>
      </View>
      <View style={styles.recentRunMetrics}>
        <Text style={styles.recentRunValue}>{formatDuration(run.activeElapsedMs)}</Text>
        <Text style={styles.recentRunMeta}>{formatPace(run.averagePaceSecondsPerKm)} /km</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: palette.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  loginContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  logo: { width: 82, height: 82, alignSelf: 'center', borderRadius: radius.md },
  brand: { marginTop: spacing.md, color: palette.text, textAlign: 'center', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  brandSubline: { marginTop: spacing.xs, color: palette.primary, textAlign: 'center', fontSize: 11, fontWeight: '800', letterSpacing: 2.4 },
  loginCard: { marginTop: spacing.xxl, gap: spacing.md, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, backgroundColor: palette.surface, padding: spacing.xl },
  cardTitle: { color: palette.text, fontSize: 25, fontWeight: '800' },
  cardCopy: { marginBottom: spacing.sm, color: palette.textMuted, lineHeight: 21 },
  input: { minHeight: 52, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, backgroundColor: palette.background, paddingHorizontal: spacing.lg, color: palette.text, fontSize: 16 },
  errorText: { color: palette.danger, lineHeight: 20 },
  primaryButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.primary, paddingHorizontal: spacing.lg },
  primaryButtonPressed: { backgroundColor: palette.primaryPressed, transform: [{ scale: 0.99 }] },
  primaryButtonText: { color: palette.background, fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  homeContent: { padding: spacing.lg, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerLogo: { width: 44, height: 44, borderRadius: radius.sm },
  headerBrand: { color: palette.text, fontSize: 17, fontWeight: '900', letterSpacing: 1.5 },
  headerSubline: { marginTop: 2, color: palette.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  logout: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  localBanner: { marginTop: spacing.xl, borderRadius: radius.md, borderWidth: 1, borderColor: palette.warning, backgroundColor: '#2A2110', padding: spacing.lg },
  localBannerTitle: { color: palette.warning, fontWeight: '800' },
  localBannerCopy: { marginTop: spacing.xs, color: palette.text, fontSize: 13, lineHeight: 19 },
  heroCard: { marginTop: spacing.xl, overflow: 'hidden', borderWidth: 1, borderColor: palette.primaryMuted, borderRadius: radius.lg, backgroundColor: palette.surfaceRaised, padding: spacing.xl },
  eyebrow: { color: palette.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  heroTitle: { marginTop: spacing.md, color: palette.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.8 },
  heroCopy: { marginTop: spacing.sm, marginBottom: spacing.lg, color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  statusRow: { marginBottom: spacing.xl, gap: spacing.sm },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: radius.pill },
  statusText: { color: palette.text, fontSize: 13, fontWeight: '600' },
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.md, color: palette.text, fontSize: 19, fontWeight: '800' },
  featureGrid: { gap: spacing.md },
  featureCard: { borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, backgroundColor: palette.surface, padding: spacing.lg },
  featureTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  featureText: { marginTop: spacing.xs, color: palette.textMuted, fontSize: 13, lineHeight: 19 },
  recentRunCard: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, backgroundColor: palette.surface, padding: spacing.lg },
  recentRunDistance: { marginTop: spacing.xs, color: palette.text, fontSize: 24, fontWeight: '900' },
  recentRunMetrics: { alignItems: 'flex-end', gap: 2 },
  recentRunValue: { color: palette.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  recentRunMeta: { color: palette.primary, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
