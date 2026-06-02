function normalizeVersionLabel(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "");
}

function versionFromChangelogHeading(heading) {
  const raw = String(heading || "").trim();
  const match = raw.match(/v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/i);
  return match ? normalizeVersionLabel(match[1]) : normalizeVersionLabel(raw);
}

function readLocaleNotes(appInfo, suffix = "") {
  const currentChangelog = String(
    appInfo?.[`currentChangelog${suffix}`] || "",
  ).trim();
  const changelog = String(appInfo?.[`changelog${suffix}`] || "").trim();
  const changelogSections = Array.isArray(appInfo?.[`changelogSections${suffix}`])
    ? appInfo[`changelogSections${suffix}`]
    : [];

  return {
    currentChangelog,
    changelog,
    changelogSections,
    displayChangelog: currentChangelog || changelog,
  };
}

export function pickReleaseNotes(appInfo, language = "en") {
  const english = readLocaleNotes(appInfo, "");
  if (language === "fa") {
    const persian = readLocaleNotes(appInfo, "Fa");
    if (hasReleaseNotes(persian)) {
      return { ...persian, locale: "fa" };
    }
  }
  return { ...english, locale: "en" };
}

export function hasReleaseNotes(notes) {
  const currentChangelog = String(notes?.currentChangelog || "").trim();
  if (currentChangelog) return true;

  const sections = notes?.changelogSections;
  if (!Array.isArray(sections) || !sections.length) {
    return Boolean(String(notes?.displayChangelog || notes?.changelog || "").trim());
  }

  return sections.some((section) => {
    const body = String(section?.body || "").trim();
    const heading = String(section?.heading || "").trim();
    return Boolean(body && heading);
  });
}

export function hasReleaseNotesForVersion(appInfo, version, language = "en") {
  const normalizedVersion = normalizeVersionLabel(version);
  if (!normalizedVersion) return false;

  const notes = pickReleaseNotes(appInfo, language);
  if (String(notes.currentChangelog || "").trim()) return true;

  return (notes.changelogSections || []).some((section) => {
    const body = String(section?.body || "").trim();
    const heading = String(section?.heading || "").trim();
    if (!body || !heading) return false;
    return versionFromChangelogHeading(heading) === normalizedVersion;
  });
}
