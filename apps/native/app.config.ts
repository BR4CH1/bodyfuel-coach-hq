import type { ConfigContext, ExpoConfig } from 'expo/config';

const bundleIdentifier = 'app.bodyfuel.mobile';

export default ({ config }: ConfigContext): ExpoConfig => {
  const appleTeamId = process.env.APPLE_TEAM_ID?.trim();
  const easProjectId = process.env.EAS_PROJECT_ID?.trim();

  return {
    ...config,
    name: 'BodyFuel',
    slug: 'bodyfuel-native',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/images/bodyfuel-icon.png',
    scheme: 'bodyfuel',
    userInterfaceStyle: 'dark',
    ios: {
      bundleIdentifier,
      supportsTablet: false,
      icon: './assets/images/bodyfuel-icon.png',
      ...(appleTeamId ? { appleTeamId } : {}),
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'BodyFuel benötigt deinen Standort, um Strecke, Distanz und Tempo während eines Laufs aufzuzeichnen.',
      },
    },
    android: {
      package: bundleIdentifier,
      adaptiveIcon: {
        backgroundColor: '#07100B',
        foregroundImage: './assets/images/bodyfuel-icon.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
      predictiveBackGestureEnabled: true,
    },
    web: {
      output: 'static',
      favicon: './assets/images/bodyfuel-icon.png',
    },
    plugins: [
      'expo-router',
      'expo-dev-client',
      '@bacons/apple-targets',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'BodyFuel benötigt deinen Standort, um Strecke, Distanz und Tempo während eines Laufs aufzuzeichnen.',
        },
      ],
      [
        'expo-secure-store',
        {
          configureAndroidBackup: true,
          faceIDPermission: 'BodyFuel darf Face ID verwenden, um deinen Zugang zu schützen.',
        },
      ],
      [
        'expo-build-properties',
        {
          ios: { deploymentTarget: '16.4' },
          android: { minSdkVersion: 26 },
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#07100B',
          image: './assets/images/bodyfuel-splash.png',
          imageWidth: 160,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: easProjectId ? { eas: { projectId: easProjectId } } : undefined,
  };
};
