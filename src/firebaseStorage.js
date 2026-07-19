/* ---------------------------------------------------------
   Ponte entre o app (que usa window.storage) e o Firebase Firestore.
   Isso permite manter o código do cardápio praticamente igual ao
   que rodava dentro do Claude, só trocando "onde" os dados são
   salvos: antes era o storage interno do Claude, agora é o Firestore.
--------------------------------------------------------- */
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Todos os dados do cardápio (catálogo, config, pedidos) ficam nesta coleção.
// Cada "key" (catalog, settings, orders) vira um documento dentro dela.
const COLLECTION = "acaiMixData";

window.storage = {
  async get(key) {
    const ref = doc(db, COLLECTION, key);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return { key, value: data.value, shared: true };
  },

  async set(key, value) {
    const ref = doc(db, COLLECTION, key);
    await setDoc(ref, { value });
    return { key, value, shared: true };
  },

  async delete(key) {
    const ref = doc(db, COLLECTION, key);
    await deleteDoc(ref);
    return { key, deleted: true, shared: true };
  },

  async list(prefix) {
    const snap = await getDocs(collection(db, COLLECTION));
    let keys = snap.docs.map((d) => d.id);
    if (prefix) keys = keys.filter((k) => k.startsWith(prefix));
    return { keys };
  },
};
