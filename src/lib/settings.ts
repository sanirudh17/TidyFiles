export interface NamingSettings {
  dateFormat: "YYYY-MM-DD" | "YYYY-MM" | "DD-MM-YYYY";
  keepSpaces: boolean;
  screenshotPrefix: string;
  version: string;
}

export const DEFAULT_SETTINGS: NamingSettings = {
  dateFormat: "YYYY-MM-DD",
  keepSpaces: true,
  screenshotPrefix: "Screenshot",
  version: "naming-v1"
};

export function getStoredSettings(): NamingSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem("tidyfiles-settings");
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function createSettingsSnapshot(settings?: Partial<NamingSettings>): NamingSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  };
}
