import type { SwimSchoolPluginConfig } from "./types.js";

const DEFAULTS: Required<
  Pick<SwimSchoolPluginConfig, "apiMode" | "coverRequestExpiryHours" | "driveFolder">
> = {
  apiMode: "mock",
  coverRequestExpiryHours: 24,
  driveFolder: "instructors",
};

export function resolveConfig(raw: Record<string, unknown> | undefined): SwimSchoolPluginConfig {
  const cfg = (raw ?? {}) as SwimSchoolPluginConfig;
  return {
    instructors: cfg.instructors ?? [],
    managers: cfg.managers ?? [],
    sites: cfg.sites ?? [],
    driveFolder: cfg.driveFolder ?? DEFAULTS.driveFolder,
    apiMode: cfg.apiMode ?? DEFAULTS.apiMode,
    apiBaseUrl: cfg.apiBaseUrl,
    coverRequestExpiryHours: cfg.coverRequestExpiryHours ?? DEFAULTS.coverRequestExpiryHours,
  };
}
