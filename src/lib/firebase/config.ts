import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const hasRealConfig = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

if (!hasRealConfig && typeof window !== "undefined") {
  // Só avisa no navegador: durante o build/SSR sem .env.local isso é esperado
  // (ex: build de CI antes da configuração), então não queremos poluir o log de build.
  // eslint-disable-next-line no-console
  console.warn(
    "[Delícias Manager] Variáveis do Firebase não configuradas. Copie .env.local.example para .env.local e preencha com as credenciais do seu projeto."
  );
}

// Config de placeholder usada apenas quando as variáveis de ambiente não existem
// (ex: build sem .env.local). Evita que o SDK do Firebase lance erro durante a
// geração estática do Next.js. Nunca é usada para autenticar de verdade — sem
// credenciais reais, qualquer chamada ao Firebase simplesmente falhará em runtime,
// o que é o comportamento correto até o .env.local ser preenchido.
const firebaseConfig = hasRealConfig
  ? {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    }
  : {
      apiKey: "build-placeholder-api-key",
      authDomain: "build-placeholder.firebaseapp.com",
      projectId: "build-placeholder",
      storageBucket: "build-placeholder.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:0000000000000000000000",
    };

// Evita reinicializar o app no hot-reload do Next.js
export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);
