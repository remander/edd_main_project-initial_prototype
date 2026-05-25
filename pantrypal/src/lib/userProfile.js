import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Persists the user's OpenAI API key to their Firestore profile settings document
export const saveOpenAiApiKey = async (userId, apiKey) => {
  const ref = doc(db, "users", userId, "profile", "settings");
  await setDoc(ref, { openAiApiKey: apiKey }, { merge: true });
};

// Reads the stored OpenAI API key from Firestore; returns null if not set
export const loadOpenAiApiKey = async (userId) => {
  const ref = doc(db, "users", userId, "profile", "settings");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().openAiApiKey || null : null;
};

// Saves a generated recipe to the user's savedMeals subcollection, keyed by meal.id
export const saveMeal = async (userId, meal) => {
  const ref = doc(db, "users", userId, "savedMeals", meal.id);
  await setDoc(ref, meal);
};
