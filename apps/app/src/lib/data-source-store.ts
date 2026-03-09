import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { logger } from "@/lib/logger";

export interface DataSourceRecord {
  id: string;
  name: string;
  type: "POSTGREST";
  description?: string;
  organizationId: string;
  connectionConfig: {
    url: string;
    encryptedToken: string;
    tokenSuffix: string;
  };
  isActive: boolean;
  lastTestedAt?: string;
  lastTestResult?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoreData {
  dataSources: DataSourceRecord[];
}

function getStorePath(): string {
  return (
    process.env.DATA_SOURCES_FILE ||
    path.join(process.cwd(), "data", "data-sources.json")
  );
}

async function readStore(): Promise<StoreData> {
  const filePath = getStorePath();
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as StoreData;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      return { dataSources: [] };
    }
    logger.error({ err, filePath }, "Failed to read data source store");
    throw err;
  }
}

async function writeStore(data: StoreData): Promise<void> {
  const filePath = getStorePath();
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function generateId(): string {
  return `ds_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export async function listByOrg(orgId: string): Promise<DataSourceRecord[]> {
  const store = await readStore();
  return store.dataSources.filter((ds) => ds.organizationId === orgId);
}

export async function getById(
  id: string
): Promise<DataSourceRecord | undefined> {
  const store = await readStore();
  return store.dataSources.find((ds) => ds.id === id);
}

export async function create(
  data: Omit<DataSourceRecord, "id" | "createdAt" | "updatedAt">
): Promise<DataSourceRecord> {
  const store = await readStore();

  const exists = store.dataSources.some(
    (ds) =>
      ds.organizationId === data.organizationId && ds.name === data.name
  );
  if (exists) {
    throw new Error(
      `A data source named "${data.name}" already exists in this organization`
    );
  }

  const now = new Date().toISOString();
  const record: DataSourceRecord = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  store.dataSources.push(record);
  await writeStore(store);
  return record;
}

export async function findAndUpdate(
  id: string,
  orgId: string,
  data: Partial<
    Omit<DataSourceRecord, "id" | "createdAt" | "updatedAt" | "organizationId">
  >
): Promise<DataSourceRecord | undefined> {
  const store = await readStore();
  const index = store.dataSources.findIndex(
    (ds) => ds.id === id && ds.organizationId === orgId
  );
  if (index === -1) return undefined;

  if (data.name && data.name !== store.dataSources[index].name) {
    const nameExists = store.dataSources.some(
      (ds) => ds.organizationId === orgId && ds.name === data.name && ds.id !== id
    );
    if (nameExists) {
      throw new Error(
        `A data source named "${data.name}" already exists in this organization`
      );
    }
  }

  store.dataSources[index] = {
    ...store.dataSources[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await writeStore(store);
  return store.dataSources[index];
}

export async function findAndRemove(id: string, orgId: string): Promise<boolean> {
  const store = await readStore();
  const initialLength = store.dataSources.length;
  store.dataSources = store.dataSources.filter(
    (ds) => !(ds.id === id && ds.organizationId === orgId)
  );

  if (store.dataSources.length === initialLength) return false;

  await writeStore(store);
  return true;
}
