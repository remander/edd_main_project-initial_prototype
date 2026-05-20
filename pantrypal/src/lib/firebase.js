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

export const firebaseSignUp = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const firebaseSignIn = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const firebaseSignOut = () => signOut(auth);

export { onAuthStateChanged };

// ── Inventory Firestore helpers ──────────────────────────────────────────────

export const subscribeToInventory = (userId, callback) =>
  onSnapshot(collection(db, "users", userId, "inventory"), (snapshot) => {
    const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
    callback(items);
  });

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

export const subscribeToUserUsageLogs = (userId, callback) =>
  onSnapshot(
    query(collection(db, "users", userId, "usageLogs"), orderBy("timestamp", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (err) => console.error("usageLogs subscription error (check Firestore rules):", err.message)
  );

export const subscribeToAllUsageLogs = (callback) =>
  onSnapshot(
    query(collection(db, "globalUsageLogs"), orderBy("timestamp", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (err) => console.error("globalUsageLogs subscription error (check Firestore rules):", err.message)
  );

export const clearUserUsageLogs = async (userId) => {
  const snap = await getDocs(collection(db, "users", userId, "usageLogs"));
  // Only delete the user's own subcollection — global docs stay for admin history
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
};
