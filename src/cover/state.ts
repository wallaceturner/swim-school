import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { CoverRequest, CoverRequestStatus } from "../types.js";

const STATE_FILE = "cover-requests.json";

/**
 * Persistent store for cover requests.
 * Uses atomic JSON file writes for durability, in-memory map for fast reads.
 */
export class CoverRequestStore {
  private requests = new Map<string, CoverRequest>();
  private stateFilePath: string;
  private loaded = false;

  constructor(stateDir: string) {
    this.stateFilePath = path.join(stateDir, STATE_FILE);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.stateFilePath, "utf-8");
      const data = JSON.parse(raw) as CoverRequest[];
      for (const req of data) {
        this.requests.set(req.id, req);
      }
    } catch {
      // File doesn't exist yet or is corrupt — start fresh
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const data = [...this.requests.values()];
    const tmpPath = this.stateFilePath + ".tmp";
    await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true });
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
    await fs.rename(tmpPath, this.stateFilePath);
  }

  async create(
    partial: Omit<
      CoverRequest,
      "id" | "createdAt" | "updatedAt" | "status" | "declinedInstructors"
    >,
  ): Promise<CoverRequest> {
    await this.ensureLoaded();
    const req: CoverRequest = {
      ...partial,
      id: crypto.randomUUID(),
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      declinedInstructors: [],
    };
    this.requests.set(req.id, req);
    await this.persist();
    return req;
  }

  async get(id: string): Promise<CoverRequest | undefined> {
    await this.ensureLoaded();
    return this.requests.get(id);
  }

  /** Find pending cover requests where the given phone was notified. */
  async findPendingForPhone(phone: string): Promise<CoverRequest[]> {
    await this.ensureLoaded();
    return [...this.requests.values()].filter(
      (r) => r.status === "pending" && r.notifiedInstructors.includes(phone),
    );
  }

  /** Find cover requests awaiting manager approval for a given manager phone. */
  async findAwaitingManagerApproval(): Promise<CoverRequest[]> {
    await this.ensureLoaded();
    return [...this.requests.values()].filter((r) => r.status === "manager_notified");
  }

  /** Transition: pending → accepted. First caller wins. */
  async accept(id: string, coveredById: string): Promise<CoverRequest | null> {
    await this.ensureLoaded();
    const req = this.requests.get(id);
    if (!req || req.status !== "pending") return null;
    req.status = "accepted";
    req.coveredById = coveredById;
    req.updatedAt = Date.now();
    await this.persist();
    return req;
  }

  /** Record a decline from an instructor. */
  async decline(id: string, phone: string): Promise<CoverRequest | null> {
    await this.ensureLoaded();
    const req = this.requests.get(id);
    if (!req || req.status !== "pending") return null;
    if (!req.declinedInstructors.includes(phone)) {
      req.declinedInstructors.push(phone);
    }
    req.updatedAt = Date.now();
    await this.persist();
    return req;
  }

  /** Transition: accepted → manager_notified. */
  async notifyManager(id: string): Promise<CoverRequest | null> {
    await this.ensureLoaded();
    const req = this.requests.get(id);
    if (!req || req.status !== "accepted") return null;
    req.status = "manager_notified";
    req.managerNotifiedAt = Date.now();
    req.updatedAt = Date.now();
    await this.persist();
    return req;
  }

  /** Transition: manager_notified → approved. */
  async approve(id: string): Promise<CoverRequest | null> {
    await this.ensureLoaded();
    const req = this.requests.get(id);
    if (!req || req.status !== "manager_notified") return null;
    req.status = "approved";
    req.updatedAt = Date.now();
    await this.persist();
    return req;
  }

  /** Transition: manager_notified → rejected. */
  async reject(id: string): Promise<CoverRequest | null> {
    await this.ensureLoaded();
    const req = this.requests.get(id);
    if (!req || req.status !== "manager_notified") return null;
    req.status = "rejected";
    req.updatedAt = Date.now();
    await this.persist();
    return req;
  }

  /** Update status to a given value. */
  async updateStatus(id: string, status: CoverRequestStatus): Promise<void> {
    await this.ensureLoaded();
    const req = this.requests.get(id);
    if (!req) return;
    req.status = status;
    req.updatedAt = Date.now();
    await this.persist();
  }

  /** Expire all pending/manager_notified requests older than the given hours. Returns expired IDs. */
  async expireStale(maxAgeHours: number): Promise<string[]> {
    await this.ensureLoaded();
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const expired: string[] = [];
    for (const req of this.requests.values()) {
      if (
        (req.status === "pending" || req.status === "manager_notified") &&
        req.createdAt < cutoff
      ) {
        req.status = "expired";
        req.updatedAt = Date.now();
        expired.push(req.id);
      }
    }
    if (expired.length > 0) {
      await this.persist();
    }
    return expired;
  }
}

/** Create a CoverRequestStore. Pass a state directory path. */
export function createCoverRequestStore(stateDir: string): CoverRequestStore {
  return new CoverRequestStore(stateDir);
}
