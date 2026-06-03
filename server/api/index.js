import { registerAppRoutes } from "./app.js";
import { registerAdminRoutes } from "./admin.js";
import { registerAuthRoutes } from "./auth.js";
import { registerChatRoutes } from "./chats.js";
import { registerE2eeRoutes } from "./e2ee.js";
import { registerHealthRoutes } from "./health.js";
import { registerMessageRoutes } from "./messages.js";
import { registerPushRoutes } from "./push.js";
import { registerPresenceRoutes } from "./presence.js";
import { registerProfileRoutes } from "./profile.js";
import { registerDmPrivacyRoutes } from "./dmPrivacy.js";
import { registerContactsRoutes } from "./contacts.js";
import { registerRemoteChannelRoutes } from "./remoteChannels.js";

/* 🔥 BirdX API */
function registerBirdxRoutes(app) {
  app.get("/api/birdx/status", (req, res) => {
    res.json({
      ok: true,
      app: "BirdX",
      edition: "Community",
      status: "running",
      timestamp: new Date().toISOString(),
    });
  });
}

function registerApiRoutes(app, deps) {
  /* Core */
  registerHealthRoutes(app, deps);
  registerAppRoutes(app, deps);
  registerAuthRoutes(app, deps);
  registerPresenceRoutes(app, deps);
  registerProfileRoutes(app, deps);
  registerChatRoutes(app, deps);
  registerDmPrivacyRoutes(app, deps);
  registerContactsRoutes(app, deps);
  registerMessageRoutes(app, deps);
  registerPushRoutes(app, deps);
  registerRemoteChannelRoutes(app, deps);
  registerE2eeRoutes(app, deps);

  /* 🔥 BirdX Custom */
  registerBirdxRoutes(app);

  /* Admin */
  registerAdminRoutes(app, deps);
}

export { registerApiRoutes };
