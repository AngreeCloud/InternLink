import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let initPromise: Promise<void> | undefined;

async function fetchPublicConfig(): Promise<FirebasePublicConfig> {
  const res = await fetch("/api/firebase-public-config", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Falha ao obter config Firebase: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as {
    ok: boolean;
    missing: string[];
    config: FirebasePublicConfig;
  };

  if (!data.ok) {
    throw new Error(
      `Firebase config em falta no server (.env.local): ${data.missing.join(", ")}`
    );
  }

  return data.config;
}

export async function ensureFirebaseInitialized(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Firebase client runtime só pode ser inicializado no browser.");
  }

  if (app) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const config = await fetchPublicConfig();
    app = getApps().length ? getApp() : initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  })();

  return initPromise;
}

export async function getAuthRuntime(): Promise<Auth> {
  await ensureFirebaseInitialized();
  return auth!;
}

export async function getDbRuntime(): Promise<Firestore> {
  await ensureFirebaseInitialized();
  return db!;
}

export async function getStorageRuntime(): Promise<FirebaseStorage> {
  await ensureFirebaseInitialized();
  return storage!;
}
