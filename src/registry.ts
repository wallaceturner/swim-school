import type { Instructor, Manager, Site, SwimSchoolPluginConfig } from "./types.js";

/** Normalizes a phone string to E.164-ish comparison form. */
function normalizePhone(phone: string): string {
  // Strip whitespace, dashes, parens; keep leading +
  return phone.replace(/[\s\-()]/g, "");
}

/** Clean a phone from WhatsApp JID or E.164 format for comparison. */
function cleanPhone(phone: string): string {
  let cleaned = phone;
  if (cleaned.includes("@")) {
    cleaned = "+" + cleaned.split("@")[0].split(":")[0];
  }
  return normalizePhone(cleaned);
}

/** Try to match a cleaned phone against a normalized phone (with/without +). */
function phonesMatch(cleaned: string, normalized: string): boolean {
  return (
    cleaned === normalized ||
    cleaned === normalized.replace(/^\+/, "") ||
    "+" + cleaned === normalized
  );
}

type KnownPerson = {
  name: string;
  phone: string;
  email: string;
  siteIds: string[];
  role: "instructor" | "manager";
};

/**
 * Registry backed by plugin config.
 * Provides lookups by phone number and email for instructors and managers.
 */
export class InstructorRegistry {
  private byPhone = new Map<string, KnownPerson>();
  private byEmail = new Map<string, KnownPerson>();
  private sites = new Map<string, Site>();

  constructor(cfg: SwimSchoolPluginConfig) {
    for (const inst of cfg.instructors ?? []) {
      const person: KnownPerson = { ...inst, role: "instructor" };
      this.byPhone.set(normalizePhone(inst.phone), person);
      this.byEmail.set(inst.email.toLowerCase(), person);
    }
    for (const mgr of cfg.managers ?? []) {
      const person: KnownPerson = { ...mgr, role: "manager" };
      this.byPhone.set(normalizePhone(mgr.phone), person);
      this.byEmail.set(mgr.email.toLowerCase(), person);
    }
    for (const site of cfg.sites ?? []) {
      this.sites.set(site.siteId, site);
    }
  }

  /** Look up a person by their phone number (E.164 or WhatsApp JID). */
  lookupByPhone(phone: string): KnownPerson | undefined {
    const cleaned = cleanPhone(phone);
    const exact = this.byPhone.get(cleaned);
    if (exact) return exact;
    // Try with/without leading +
    if (cleaned.startsWith("+")) {
      return this.byPhone.get(cleaned.slice(1));
    }
    return this.byPhone.get("+" + cleaned);
  }

  /** Look up a person by email. */
  lookupByEmail(email: string): KnownPerson | undefined {
    return this.byEmail.get(email.toLowerCase());
  }

  /** Check if a phone number belongs to a registered instructor or manager. */
  isKnownPerson(phone: string): boolean {
    return this.lookupByPhone(phone) !== undefined;
  }

  getSite(siteId: string): Site | undefined {
    return this.sites.get(siteId);
  }

  getAllSites(): Site[] {
    return [...this.sites.values()];
  }

  /** Get all instructors at a site, optionally excluding one by email. */
  getInstructorsForSite(siteId: string, excludeEmail?: string): KnownPerson[] {
    const result: KnownPerson[] = [];
    for (const person of this.byEmail.values()) {
      if (person.role === "instructor" && person.siteIds.includes(siteId)) {
        if (!excludeEmail || person.email.toLowerCase() !== excludeEmail.toLowerCase()) {
          result.push(person);
        }
      }
    }
    return result;
  }

  /** Get all managers for a site. */
  getManagersForSite(siteId: string): KnownPerson[] {
    const result: KnownPerson[] = [];
    for (const person of this.byEmail.values()) {
      if (person.role === "manager" && person.siteIds.includes(siteId)) {
        result.push(person);
      }
    }
    return result;
  }
}
