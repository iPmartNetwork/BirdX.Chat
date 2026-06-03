import {
  Ban,
  Chat,
  Database,
  Download,
  File,
  Globe,
  LayoutDashboard,
  Megaphone,
  Monitor,
  Pencil,
  Phone,
  Settings,
  ShieldCheck,
  Clock12,
  Users,
} from "../../icons/lucide.js";

export const ADMIN_TAB_GROUPS = [
  {
    id: "dashboard",
    labelKey: "admin.group.dashboard",
    tabs: [
      { id: "overview", labelKey: "admin.tab.overview", icon: LayoutDashboard },
      { id: "analytics", labelKey: "admin.tab.analytics", icon: Globe },
      { id: "monitor", labelKey: "admin.tab.monitor", icon: Monitor },
    ],
  },
  {
    id: "people",
    labelKey: "admin.group.people",
    tabs: [
      { id: "users", labelKey: "admin.tab.users", icon: Users },
      { id: "calls", labelKey: "admin.tab.calls", icon: Phone },
      { id: "moderation", labelKey: "admin.tab.moderation", icon: Ban },
    ],
  },
  {
    id: "content",
    labelKey: "admin.group.content",
    tabs: [
      { id: "chats", labelKey: "admin.tab.chats", icon: Chat },
      { id: "files", labelKey: "admin.tab.files", icon: File },
      { id: "scheduled", labelKey: "admin.tab.scheduled", icon: Clock12 },
    ],
  },
  {
    id: "comms",
    labelKey: "admin.group.comms",
    tabs: [{ id: "broadcast", labelKey: "admin.tab.broadcast", icon: Megaphone }],
  },
  {
    id: "integrations",
    labelKey: "admin.group.integrations",
    tabs: [
      { id: "webhooks", labelKey: "admin.tab.webhooks", icon: Globe },
      { id: "bots", labelKey: "admin.tab.bots", icon: ShieldCheck },
    ],
  },
  {
    id: "system",
    labelKey: "admin.group.system",
    tabs: [
      { id: "server", labelKey: "admin.tab.server", icon: Settings },
      { id: "export", labelKey: "admin.tab.export", icon: Download },
      { id: "branding", labelKey: "admin.tab.branding", icon: Pencil },
      { id: "audit", labelKey: "admin.tab.audit", icon: ShieldCheck },
      { id: "maintenance", labelKey: "admin.tab.maintenance", icon: Database },
    ],
  },
];

export const ADMIN_TAB_TITLE_KEYS = {
  overview: "admin.tab.overview",
  analytics: "admin.tab.analytics",
  monitor: "admin.tab.monitor",
  users: "admin.tab.users",
  calls: "admin.tab.calls",
  moderation: "admin.tab.moderation",
  chats: "admin.tab.chats",
  files: "admin.tab.files",
  scheduled: "admin.tab.scheduled",
  broadcast: "admin.tab.broadcast",
  webhooks: "admin.tab.webhooks",
  bots: "admin.tab.bots",
  server: "admin.tab.server",
  export: "admin.tab.export",
  branding: "admin.tab.branding",
  audit: "admin.tab.audit",
  maintenance: "admin.tab.maintenance",
};
