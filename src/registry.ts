import type { Instructor, Site, SwimSchoolPluginConfig } from "./types.js";

/** Normalizes a phone string to E.164-ish comparison form. */
function normalizePhone(phone: string): string {
  // Strip whitespace, dashes, parens; keep leading +
  return phone.replace(/[\s\-()]/g, "");
}

/**
 * Instructor registry backed by plugin config.
 * Provides lookups by phone number, site, and instructor ID.
 */
export class InstructorRegistry {
  private byPhone = new Map<string, Instructor>();
  private byId = new Map<string, Instructor>();
  private bySite = new Map<string, Instructor[]>();
  private sites = new Map<string, Site>();

  constructor(cfg: SwimSchoolPluginConfig) {
    for (const inst of cfg.instructors ?? []) {
      const normalized = normalizePhone(inst.phone);
      this.byPhone.set(normalized, inst);
      this.byId.set(inst.instructorId, inst);
      const siteList = this.bySite.get(inst.siteId) ?? [];
      siteList.push(inst);
      this.bySite.set(inst.siteId, siteList);
    }
    for (const site of cfg.sites ?? []) {
      this.sites.set(site.siteId, site);
    }
  }

  /** Look up an instructor by their phone number (E.164 or WhatsApp JID). */
  lookupByPhone(phone: string): Instructor | undefined {
    // WhatsApp JIDs look like "61400000000@s.whatsapp.net" — extract the number
    let cleaned = phone;
    if (cleaned.includes("@")) {
      cleaned = "+" + cleaned.split("@")[0].split(":")[0];
    }
    cleaned = normalizePhone(cleaned);
    // Try exact match first
    const exact = this.byPhone.get(cleaned);
    if (exact) return exact;
    // Try with/without leading +
    if (cleaned.startsWith("+")) {
      return this.byPhone.get(cleaned.slice(1));
    }
    return this.byPhone.get("+" + cleaned);
  }

  lookupById(instructorId: string): Instructor | undefined {
    return this.byId.get(instructorId);
  }

  /** Get all instructors at a site, optionally excluding one. */
  getSiteInstructors(siteId: string, excludeId?: string): Instructor[] {
    const all = this.bySite.get(siteId) ?? [];
    if (!excludeId) return all;
    return all.filter((i) => i.instructorId !== excludeId);
  }

  getSite(siteId: string): Site | undefined {
    return this.sites.get(siteId);
  }

  getAllSites(): Site[] {
    return [...this.sites.values()];
  }

  /** Check if a phone number belongs to a registered instructor or site manager. */
  isKnownPerson(phone: string): boolean {
    if (this.lookupByPhone(phone)) return true;
    // Check site managers
    let cleaned = phone;
    if (cleaned.includes("@")) {
      cleaned = "+" + cleaned.split("@")[0].split(":")[0];
    }
    cleaned = normalizePhone(cleaned);
    for (const site of this.sites.values()) {
      const managerNormalized = normalizePhone(site.managerPhone);
      if (
        cleaned === managerNormalized ||
        cleaned === managerNormalized.replace(/^\+/, "") ||
        "+" + cleaned === managerNormalized
      ) {
        return true;
      }
    }
    return false;
  }
}
