import type { Message, Customer } from "@shared/schema";

const DB_NAME = "contextify-cache";
const DB_VERSION = 1;
const MESSAGES_STORE = "messages";
const CUSTOMERS_STORE = "customers";
const SYNC_META_STORE = "sync-meta";

interface SyncMeta {
  key: string;
  lastSyncTimestamp: number;
  lastMessageId?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const messagesStore = db.createObjectStore(MESSAGES_STORE, { keyPath: "id" });
        messagesStore.createIndex("customerId", "customerId", { unique: false });
        messagesStore.createIndex("timestamp", "timestamp", { unique: false });
        messagesStore.createIndex("customerTimestamp", ["customerId", "timestamp"], { unique: false });
      }

      if (!db.objectStoreNames.contains(CUSTOMERS_STORE)) {
        db.createObjectStore(CUSTOMERS_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(SYNC_META_STORE)) {
        db.createObjectStore(SYNC_META_STORE, { keyPath: "key" });
      }
    };
  });

  return dbPromise;
}

export async function getCachedMessages(customerId: string): Promise<Message[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MESSAGES_STORE, "readonly");
      const store = transaction.objectStore(MESSAGES_STORE);
      const index = store.index("customerId");
      const request = index.getAll(customerId);

      request.onsuccess = () => {
        const messages = request.result as Message[];
        messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        resolve(messages);
      };

      request.onerror = () => {
        console.error("Failed to get cached messages:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("IndexedDB error:", error);
    return [];
  }
}

export async function cacheMessages(messages: Message[]): Promise<void> {
  if (messages.length === 0) return;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MESSAGES_STORE, "readwrite");
      const store = transaction.objectStore(MESSAGES_STORE);

      for (const message of messages) {
        store.put(message);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error("Failed to cache messages:", transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("IndexedDB error:", error);
  }
}

export async function cacheMessage(message: Message): Promise<void> {
  return cacheMessages([message]);
}

export async function getLastMessageTimestamp(customerId: string): Promise<number | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MESSAGES_STORE, "readonly");
      const store = transaction.objectStore(MESSAGES_STORE);
      const index = store.index("customerTimestamp");
      
      const range = IDBKeyRange.bound([customerId, ""], [customerId, "\uffff"]);
      const request = index.openCursor(range, "prev");

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const message = cursor.value as Message;
          resolve(new Date(message.timestamp).getTime());
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error("Failed to get last message timestamp:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("IndexedDB error:", error);
    return null;
  }
}

export async function getCachedCustomers(): Promise<Customer[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CUSTOMERS_STORE, "readonly");
      const store = transaction.objectStore(CUSTOMERS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as Customer[]);
      };

      request.onerror = () => {
        console.error("Failed to get cached customers:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("IndexedDB error:", error);
    return [];
  }
}

export async function cacheCustomers(customers: Customer[]): Promise<void> {
  if (customers.length === 0) return;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CUSTOMERS_STORE, "readwrite");
      const store = transaction.objectStore(CUSTOMERS_STORE);

      for (const customer of customers) {
        store.put(customer);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error("Failed to cache customers:", transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("IndexedDB error:", error);
  }
}

export async function updateCachedCustomer(customer: Partial<Customer> & { id: string }): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CUSTOMERS_STORE, "readwrite");
      const store = transaction.objectStore(CUSTOMERS_STORE);
      
      const getRequest = store.get(customer.id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result as Customer | undefined;
        if (existing) {
          store.put({ ...existing, ...customer });
        } else {
          store.put(customer);
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error("Failed to update cached customer:", transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("IndexedDB error:", error);
  }
}

export async function getSyncMeta(key: string): Promise<SyncMeta | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SYNC_META_STORE, "readonly");
      const store = transaction.objectStore(SYNC_META_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result as SyncMeta | null);
      };

      request.onerror = () => {
        console.error("Failed to get sync meta:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("IndexedDB error:", error);
    return null;
  }
}

export async function updateSyncMeta(meta: SyncMeta): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SYNC_META_STORE, "readwrite");
      const store = transaction.objectStore(SYNC_META_STORE);
      store.put(meta);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error("Failed to update sync meta:", transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("IndexedDB error:", error);
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [MESSAGES_STORE, CUSTOMERS_STORE, SYNC_META_STORE],
        "readwrite"
      );

      transaction.objectStore(MESSAGES_STORE).clear();
      transaction.objectStore(CUSTOMERS_STORE).clear();
      transaction.objectStore(SYNC_META_STORE).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error("Failed to clear cache:", transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error("IndexedDB error:", error);
  }
}

export async function getMessageCount(customerId?: string): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MESSAGES_STORE, "readonly");
      const store = transaction.objectStore(MESSAGES_STORE);
      
      let request: IDBRequest<number>;
      if (customerId) {
        const index = store.index("customerId");
        request = index.count(customerId);
      } else {
        request = store.count();
      }

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error("Failed to get message count:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("IndexedDB error:", error);
    return 0;
  }
}
