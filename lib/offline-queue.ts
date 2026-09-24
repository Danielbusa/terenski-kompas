export type QueueTable = "visits" | "recruits" | "incidents" | "travel_expenses" | "activity_logs";

export type QueueItem = {
  id: string;
  table: QueueTable;
  payload: Record<string, unknown>;
  attachment?: {
    bucket: "incident-media" | "expense-receipts";
    path: string;
    field: "media_urls" | "receipt_path";
    file: Blob;
  };
  createdAt: string;
};

const DB_NAME = "terenski-kompas";
const QUEUE_STORE = "pending-submissions";
const CACHE_STORE = "cached-data";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(QUEUE_STORE)) {
        request.result.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains(CACHE_STORE)) {
        request.result.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueue(table: QueueTable, payload: Record<string, unknown>, attachment?: QueueItem["attachment"]) {
  const db = await openDatabase();
  const item: QueueItem = {
    id: crypto.randomUUID(),
    table,
    payload,
    attachment,
    createdAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return item;
}

export async function readQueue(): Promise<QueueItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(QUEUE_STORE).objectStore(QUEUE_STORE).getAll();
    request.onsuccess = () => resolve(request.result as QueueItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueued(id: string) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheData<T>(key: string, value: T) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).put({ key, value, cachedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function readCachedData<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(CACHE_STORE).objectStore(CACHE_STORE).get(key);
    request.onsuccess = () => resolve((request.result?.value as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function flushQueue() {
  const { getSupabase } = await import("@/lib/supabase/client");
  const supabase = getSupabase();
  if (!supabase || !navigator.onLine) return { synced: 0, failed: 0 };
  let synced = 0;
  let failed = 0;
  for (const item of await readQueue()) {
    const payload = { ...item.payload };
    if (item.attachment) {
      const upload = await supabase.storage.from(item.attachment.bucket).upload(item.attachment.path, item.attachment.file, { upsert: false });
      if (upload.error && !upload.error.message.toLowerCase().includes("already exists")) {
        failed += 1;
        continue;
      }
      payload[item.attachment.field] = item.attachment.field === "media_urls" ? [item.attachment.path] : item.attachment.path;
    }
    const { error } = await supabase.from(item.table).insert(payload);
    if (error) {
      failed += 1;
      continue;
    }
    if (item.table === "visits" && typeof item.payload.task_id === "string") {
      await supabase.from("field_tasks").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", item.payload.task_id);
    }
    await removeQueued(item.id);
    synced += 1;
  }
  return { synced, failed };
}
