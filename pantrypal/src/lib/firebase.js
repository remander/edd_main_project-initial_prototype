import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Creates a new Firebase account with email/password
export const firebaseSignUp = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

// Signs an existing user in with email/password
export const firebaseSignIn = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

// Signs the current user out
export const firebaseSignOut = () => signOut(auth);

export { onAuthStateChanged };

// ── Inventory Firestore helpers ──────────────────────────────────────────────

// Opens a real-time listener on the user's inventory subcollection; calls callback on every change
export const subscribeToInventory = (userId, callback) =>
  onSnapshot(collection(db, "users", userId, "inventory"), (snapshot) => {
    const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
    callback(items);
  });

// Writes (or overwrites) a single inventory item document under the user's subcollection
export const saveInventoryItem = (userId, item) =>
  setDoc(doc(db, "users", userId, "inventory", String(item.id)), {
    name:       item.name,
    category:   item.category   ?? "Other",
    quantity:   Number(item.quantity),
    unit:       item.unit       ?? "count",
    location:   item.location   ?? "Fridge",
    purchased:  item.purchased  ?? "",
    expiration: item.expiration ?? "",
    updatedAt:  serverTimestamp(),
  });

// Permanently deletes a single inventory item document
export const deleteInventoryItem = (userId, itemId) =>
  deleteDoc(doc(db, "users", userId, "inventory", String(itemId)));

// ── Usage Log Firestore helpers ──────────────────────────────────────────────

// Writes to both the user's subcollection and a global collection for admin view
export const saveUsageLog = async (userId, userEmail, log) => {
  const payload = { ...log, userId, userEmail, savedAt: serverTimestamp() };
  const id = String(log.id);
  await Promise.all([
    setDoc(doc(db, "users", userId, "usageLogs", id), payload),
    setDoc(doc(db, "globalUsageLogs", id), payload),
  ]);
};

// Real-time listener for a single user's usage logs, ordered newest-first
export const subscribeToUserUsageLogs = (userId, callback) =>
  onSnapshot(
    query(collection(db, "users", userId, "usageLogs"), orderBy("timestamp", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (err) => console.error("usageLogs subscription error (check Firestore rules):", err.message)
  );

// Real-time listener for every user's logs in globalUsageLogs — admin use only
export const subscribeToAllUsageLogs = (callback) =>
  onSnapshot(
    query(collection(db, "globalUsageLogs"), orderBy("timestamp", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (err) => console.error("globalUsageLogs subscription error (check Firestore rules):", err.message)
  );

// Deletes a single usage log entry from both the user's subcollection and the global admin collection
export const deleteUsageLog = async (userId, logId) => {
  const id = String(logId);
  await Promise.all([
    deleteDoc(doc(db, "users", userId, "usageLogs", id)),
    deleteDoc(doc(db, "globalUsageLogs", id)),
  ]);
};

// Deletes all docs in the user's usageLogs subcollection; global docs are intentionally kept for admin history
export const clearUserUsageLogs = async (userId) => {
  const snap = await getDocs(collection(db, "users", userId, "usageLogs"));
  // Only delete the user's own subcollection — global docs stay for admin history
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
};
