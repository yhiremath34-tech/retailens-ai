import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { buildSeedDatabaseState, computeStockStatus } from "@/lib/seed-data";
import { DatabaseState, InventoryMovement } from "@/types/retailens";

let memoryCache: DatabaseState | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function resolveDbFilePath(): string {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return path.join(os.tmpdir(), "retailens-db.json");
  }
  return path.join(process.cwd(), ".data", "retailens-db.json");
}

async function ensureDirForFile(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readLocalDb(): Promise<DatabaseState> {
  if (memoryCache) return memoryCache;

  const filePath = resolveDbFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as DatabaseState;
    memoryCache = parsed;
    return parsed;
  } catch {
    const seed = buildSeedDatabaseState();
    await writeLocalDb(seed);
    return seed;
  }
}

export async function writeLocalDb(nextState: DatabaseState): Promise<DatabaseState> {
  const filePath = resolveDbFilePath();
  memoryCache = nextState;
  await ensureDirForFile(filePath);
  const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(nextState, null, 2), "utf8");
  await fs.rename(tmpPath, filePath);
  return nextState;
}

export function withLocalDbTransaction<T>(
  fn: (state: DatabaseState) => Promise<T> | T
): Promise<T> {
  const run = writeQueue.then(async () => {
    const current = await readLocalDb();
    const cloned = structuredClone(current);
    const result = await fn(cloned);
    await writeLocalDb(cloned);
    return result;
  });

  writeQueue = run.catch(() => undefined);
  return run;
}

export async function resetLocalDbToSeed(): Promise<DatabaseState> {
  return withLocalDbTransaction((state) => {
    const fresh = buildSeedDatabaseState();
    // Preserve custom non-seed user accounts created during session if any, plus seed profiles
    const existingCustomProfiles = state.profiles.filter(
      (p) => !fresh.profiles.some((sp) => sp.email === p.email)
    );
    Object.assign(state, fresh);
    state.profiles = [...fresh.profiles, ...existingCustomProfiles];
    return state;
  });
}

export function applyAtomicInventoryDeltaInMemory(
  state: DatabaseState,
  params: {
    productId: string;
    quantityDelta: number;
    movementType: InventoryMovement["movementType"];
    reason: string;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey?: string;
    performedBy: string;
  }
): {
  idempotentReplay: boolean;
  movement: InventoryMovement;
  quantityBefore: number;
  quantityAfter: number;
} {
  if (params.idempotencyKey) {
    const existing = state.inventoryMovements.find(
      (m) => m.idempotencyKey === params.idempotencyKey
    );
    if (existing) {
      return {
        idempotentReplay: true,
        movement: existing,
        quantityBefore: existing.quantityBefore,
        quantityAfter: existing.quantityAfter,
      };
    }
  }

  const product = state.products.find((p) => p.id === params.productId);
  if (!product) {
    throw new Error(`Product ${params.productId} not found in store inventory.`);
  }

  const before = product.availableQuantity;
  const after = before + params.quantityDelta;
  if (after < 0) {
    throw new Error(
      `Insufficient stock for ${product.sku} (${product.name}): available ${before}, requested delta ${params.quantityDelta}.`
    );
  }

  product.availableQuantity = after;
  product.stockStatus = computeStockStatus(after, product.minStockThreshold);
  product.lastCountedAt = new Date().toISOString();

  const movement: InventoryMovement = {
    id: crypto.randomUUID(),
    storeId: state.store.id,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    movementType: params.movementType,
    quantityDelta: params.quantityDelta,
    quantityBefore: before,
    quantityAfter: after,
    reason: params.reason,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    idempotencyKey: params.idempotencyKey,
    performedBy: params.performedBy,
    createdAt: new Date().toISOString(),
  };

  state.inventoryMovements.unshift(movement);
  return {
    idempotentReplay: false,
    movement,
    quantityBefore: before,
    quantityAfter: after,
  };
}

