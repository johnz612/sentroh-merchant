/**
 * Adds the Google Maps key for Android at build time (EAS secret or local
 * environment variable GOOGLE_MAPS_ANDROID_API_KEY, the same key as the customer
 * app). The key is restricted to the Sentroh apps in Google Cloud and is never committed.
 */
export default ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  return {
    ...config,
    android: {
      ...config.android,
      ...(key ? { config: { ...(config.android?.config || {}), googleMaps: { apiKey: key } } } : {}),
    },
    // Lets the map screen know whether this build has a key (without it the map would crash).
    extra: { ...config.extra, mapsKeyInBuild: Boolean(key) },
  };
};
