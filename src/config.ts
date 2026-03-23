import type { Instructor, Site, AllowedDoc, SwimSchoolPluginConfig } from "./types.js";

const DEFAULTS: Required<
  Pick<SwimSchoolPluginConfig, "apiMode" | "coverRequestExpiryHours" | "gwBinaryPath">
> = {
  apiMode: "mock",
  coverRequestExpiryHours: 24,
  gwBinaryPath: "gw",
};

export function resolveConfig(raw: Record<string, unknown> | undefined): SwimSchoolPluginConfig {
  const cfg = (raw ?? {}) as SwimSchoolPluginConfig;
  return {
    instructors: cfg.instructors ?? [],
    sites: cfg.sites ?? [],
    allowedDocs: cfg.allowedDocs ?? [],
    apiMode: cfg.apiMode ?? DEFAULTS.apiMode,
    apiBaseUrl: cfg.apiBaseUrl,
    coverRequestExpiryHours: cfg.coverRequestExpiryHours ?? DEFAULTS.coverRequestExpiryHours,
    gwBinaryPath: cfg.gwBinaryPath ?? DEFAULTS.gwBinaryPath,
  };
}

export function getInstructors(cfg: SwimSchoolPluginConfig): Instructor[] {
  return cfg.instructors ?? [];
}

export function getSites(cfg: SwimSchoolPluginConfig): Site[] {
  return cfg.sites ?? [];
}

export function getAllowedDocs(cfg: SwimSchoolPluginConfig): AllowedDoc[] {
  return cfg.allowedDocs ?? [];
}
