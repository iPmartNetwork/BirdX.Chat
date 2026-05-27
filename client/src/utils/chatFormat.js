export const formatBytesAsMb = (bytes) =>
  `${Math.round(Number(bytes || 0) / (1024 * 1024))} MB`;

export const APP_TIME_ZONE = "Asia/Tehran";

const zonedDateTimePartFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

const getZonedParts = (date) => {
  const parts = zonedDateTimePartFormatter.formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
};

const getAppTimeZoneOffsetMs = (date) => {
  const parts = getZonedParts(date);
  const zonedAsUtc = Date.UTC(
    parts.year || 0,
    (parts.month || 1) - 1,
    parts.day || 1,
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0,
  );
  return zonedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
};

const parseAppTimeZoneDate = (value) => {
  const match = String(value || "").match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/,
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second = "0", millisecond = "0"] =
    match;
  const wallTimeAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millisecond.padEnd(3, "0")),
  );
  const firstOffset = getAppTimeZoneOffsetMs(new Date(wallTimeAsUtc));
  let instant = wallTimeAsUtc - firstOffset;
  const secondOffset = getAppTimeZoneOffsetMs(new Date(instant));
  if (secondOffset !== firstOffset) {
    instant = wallTimeAsUtc - secondOffset;
  }
  return new Date(instant);
};

export const parseServerDate = (value) => {
  if (!value) return new Date();
  if (typeof value === "string") {
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
    if (hasExplicitTimezone) return new Date(normalized);
    // Server stores timestamps in UTC (SQLite datetime('now')), treat as UTC
    return new Date(normalized + "Z");
  }
  return new Date(value);
};

const datePartFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const getDatePartsInAppTimeZone = (dateValue) => {
  const date = parseServerDate(dateValue);
  if (!Number.isFinite(date.getTime())) {
    return { year: 0, month: 0, day: 0 };
  }
  const parts = datePartFormatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year || 0,
    month: values.month || 0,
    day: values.day || 0,
  };
};

const getDayOrdinal = (dateValue) => {
  const { year, month, day } = getDatePartsInAppTimeZone(dateValue);
  if (!year || !month || !day) return NaN;
  return Math.floor(Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24));
};

export const formatDayKey = (dateValue) => {
  const { year, month, day } = getDatePartsInAppTimeZone(dateValue);
  return year && month && day ? `${year}-${month}-${day}` : "";
};

export const formatDayLabel = (dateValue) => {
  const now = new Date();
  const date = parseServerDate(dateValue);
  const diffDays = getDayOrdinal(now) - getDayOrdinal(date);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString(undefined, {
      timeZone: APP_TIME_ZONE,
      weekday: "long",
    });
  }
  return date.toLocaleDateString(undefined, {
    timeZone: APP_TIME_ZONE,
    month: "long",
    day: "numeric",
  });
};

export const formatTime = (dateValue) =>
  parseServerDate(dateValue).toLocaleTimeString(undefined, {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export const formatFullDate = (dateValue) =>
  parseServerDate(dateValue).toLocaleDateString(undefined, {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const formatChatCardTimestamp = (dateValue) => {
  const date = parseServerDate(dateValue);
  if (!Number.isFinite(date.getTime())) return "";

  const now = new Date();
  const diffDays = getDayOrdinal(now) - getDayOrdinal(date);

  if (diffDays <= 0) {
    return formatTime(date);
  }

  if (diffDays < 7) {
    return date
      .toLocaleDateString("en-US", {
        timeZone: APP_TIME_ZONE,
        weekday: "short",
      })
      .slice(0, 3);
  }

  if (
    getDatePartsInAppTimeZone(date).year === getDatePartsInAppTimeZone(now).year
  ) {
    return date.toLocaleDateString("en-US", {
      timeZone: APP_TIME_ZONE,
      month: "2-digit",
      day: "2-digit",
    });
  }

  return date.toLocaleDateString("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
};
