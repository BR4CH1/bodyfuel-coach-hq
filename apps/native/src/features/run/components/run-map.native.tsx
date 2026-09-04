import MapView, { Polyline } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';

import { palette, radius } from '@/theme/tokens';
import type { LocationPoint } from '../domain/run-session';

export function RunMap({ points }: { points: LocationPoint[] }) {
  const latest = points.at(-1);

  if (!latest) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>GPS wird gesucht …</Text>
        <Text style={styles.placeholderCopy}>Die Route erscheint nach dem ersten gültigen Standortpunkt.</Text>
      </View>
    );
  }

  const coordinates = points.map(({ latitude, longitude }) => ({ latitude, longitude }));

  return (
    <MapView
      style={styles.map}
      userInterfaceStyle="dark"
      showsUserLocation
      showsMyLocationButton={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      region={{
        latitude: latest.latitude,
        longitude: latest.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      }}>
      {coordinates.length > 1 ? (
        <Polyline coordinates={coordinates} strokeColor={palette.primary} strokeWidth={5} />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 230,
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  placeholder: {
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 24,
  },
  placeholderTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  placeholderCopy: {
    marginTop: 8,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
