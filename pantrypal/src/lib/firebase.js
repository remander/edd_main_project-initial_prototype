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
  onSnapshot,
  serverTimestamp,
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
