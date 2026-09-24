export type QueueItem = {
  id: string;
  table: "canvassing_points" | "recruits" | "incidents" | "donations";
  payload: Record<string, unknown>;
  createdAt: string;
};

const DB_NAME = "terenski-kompas";
const STORE = "pending-submissions";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueue(
  table: QueueItem["table"],
  payload: QueueItem["payload"],
) {
  const db = await openDatabase();
  const item: QueueItem = {
    id: crypto.randomUUID(),
    table,
    payload,
    createdAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return item;
}

export async function readQueue(): Promise<QueueItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as QueueItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueued(id: string) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function flushQueue() {
  const { getSupabase } = await import("@/lib/supabase/client");
  const supabase = getSupabase();
  if (!supabase || !navigator.onLine) return { synced: 0 };
  let synced = 0;
  for (const item of await readQueue()) {
    const { error } = await supabase.from(item.table).insert(item.payload);
    if (!error) {
      await removeQueued(item.id);
      synced += 1;
    }
  }
  return { synced };
}
