import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const hasRealConfig = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

if (!hasRealConfig && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn(
    "[Delícias Manager] Variáveis do Firebase não configuradas. Copie .env.local.example para .env.local e preencha com as credenciais do seu projeto."
  );
}

export const firebaseConfig = hasRealConfig
  ? {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    }
  : {
      apiKey: "build-placeholder-api-key",
      authDomain: "build-placeholder.firebaseapp.com",
      projectId: "build-placeholder",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:0000000000000000000000",
    };

export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
