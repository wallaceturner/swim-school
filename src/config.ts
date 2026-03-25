import type { Instructor, Site, SwimSchoolPluginConfig } from "./types.js";

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
    sites: cfg.sites ?? [],
    driveFolder: cfg.driveFolder ?? DEFAULTS.driveFolder,
    apiMode: cfg.apiMode ?? DEFAULTS.apiMode,
    apiBaseUrl: cfg.apiBaseUrl,
    coverRequestExpiryHours: cfg.coverRequestExpiryHours ?? DEFAULTS.coverRequestExpiryHours,
  };
}

export function getInstructors(cfg: SwimSchoolPluginConfig): Instructor[] {
  return cfg.instructors ?? [];
}

export function getSites(cfg: SwimSchoolPluginConfig): Site[] {
  return cfg.sites ?? [];
}
