import { readAppMeta } from "../lib/appMeta.js";
import { getGroupCallConfig } from "../lib/groupCallConfig.js";
import { getRtcPublicConfig } from "../lib/rtcConfig.js";

function registerAppRoutes(app, deps) {
  const { REMOTE_CHANNELS, fs, path, projectRootDir, getAppBranding } = deps;

  app.get("/api/branding", (_req, res) => {
    const branding = getAppBranding?.() || {
      appName: "BirdX",
      accentColor: "#10b981",
      logoUrl: "",
      faviconUrl: "",
    };
    res.json({ ok: true, branding });
  });

  app.get("/api/app/info", (_req, res) => {
    const appMeta = readAppMeta({ fs, path, projectRootDir });
    res.json({
      version: appMeta.version,
      normalizedVersion: appMeta.normalizedVersion,
      changelog: appMeta.changelog,
      changelogSections: appMeta.changelogSections,
      currentChangelog: appMeta.currentChangelog,
      changelogFa: appMeta.changelogFa,
      changelogSectionsFa: appMeta.changelogSectionsFa,
      currentChangelogFa: appMeta.currentChangelogFa,
      repository: appMeta.repository,
      remoteChannels: {
        enabled: Boolean(
          REMOTE_CHANNELS?.enabled && REMOTE_CHANNELS?.telegramConfigured,
        ),
        telegramConfigured: Boolean(REMOTE_CHANNELS?.telegramConfigured),
        proxyConfigured: Boolean(REMOTE_CHANNELS?.proxyConfigured),
      },
      groupCalls: getGroupCallConfig(),
      rtc: getRtcPublicConfig(),
    });
  });
}

export { registerAppRoutes };
