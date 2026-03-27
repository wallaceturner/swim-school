import type { SwimSchoolPluginConfig } from "../types.js";
import { MockShiftApiClient } from "./mock-client.js";
import type { ShiftApiClient } from "./types.js";

/**
 * Factory that returns the appropriate ShiftApiClient based on config.
 * Currently only "mock" is implemented; "live" will call the real HTTP API.
 */
export function createShiftApiClient(cfg: SwimSchoolPluginConfig): ShiftApiClient {
  if (cfg.apiMode === "live" && cfg.apiBaseUrl) {
    // TODO: implement LiveShiftApiClient when the API is ready
    throw new Error(
      `Live shift API not yet implemented. Set apiMode to "mock" or provide implementation.`,
    );
  }

  const instructorIds = (cfg.instructors ?? []).map((i) => i.email);
  const siteIds = (cfg.sites ?? []).map((s) => s.siteId);
  return new MockShiftApiClient(instructorIds, siteIds);
}
