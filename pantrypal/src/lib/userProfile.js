import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const saveOpenAiApiKey = async (userId, apiKey) => {
  const ref = doc(db, "users", userId, "profile", "settings");
  await setDoc(ref, { openAiApiKey: apiKey }, { merge: true });
};

export const loadOpenAiApiKey = async (userId) => {
  const ref = doc(db, "users", userId, "profile", "settings");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().openAiApiKey || null : null;
};

export const saveMeal = async (userId, meal) => {
  const ref = doc(db, "users", userId, "savedMeals", meal.id);
  await setDoc(ref, meal);
};
