import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDHep9-aTU_VGttWmbySGlm3n8TezqBtKM",
  authDomain: "lost-found-school-edd3c.firebaseapp.com",
  projectId: "lost-found-school-edd3c",
  storageBucket: "lost-found-school-edd3c.firebasestorage.app",
  messagingSenderId: "1073299011992",
  appId: "1:1073299011992:web:80e2ae2572d34da9b493ed",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;