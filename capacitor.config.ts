import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bodyfuel.app",
  appName: "BodyFuel",
  webDir: "native-dist",
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
