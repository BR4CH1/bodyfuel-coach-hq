/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'watch',
  name: 'BodyFuelWatch',
  displayName: 'BodyFuel',
  bundleIdentifier: '.watch',
  icon: '../../assets/images/bodyfuel-icon.png',
  colors: {
    $accent: '#2ED66B',
  },
  deploymentTarget: '10.0',
  frameworks: ['SwiftUI', 'HealthKit', 'WatchKit', 'WatchConnectivity'],
  entitlements: {
    'com.apple.developer.healthkit': true,
  },
});
