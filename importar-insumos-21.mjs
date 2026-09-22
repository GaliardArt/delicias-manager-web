/*
 * Importação em lote dos 21 novos insumos.
 *
 * Antes de executar, defina as variáveis no PowerShell:
 *
 * $env:FIREBASE_API_KEY="..."
 * $env:FIREBASE_AUTH_DOMAIN="..."
 * $env:FIREBASE_PROJECT_ID="..."
 * $env:FIREBASE_MESSAGING_SENDER_ID="..."
 * $env:FIREBASE_APP_ID="..."
 * $env:FIREBASE_USER_EMAIL="adm@adm.com"
 * $env:FIREBASE_USER_PASSWORD="sua-senha"
 *
 * Depois:
 *   node importar-insumos-21.mjs
 *
 * Instale o Firebase SDK caso ainda não tenha:
 *   npm install firebase
 */

import fs from "node:fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

const required = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "FIREBASE_USER_EMAIL",
  "FIREBASE_USER_PASSWORD",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Variável ausente no PowerShell: ${key}`);
  }
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

function normalizeName(name) {
  return String(name)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function computeUnitCostCents(priceCents, quantity) {
  return quantity > 0 ? priceCents / quantity : 0;
}

const input = JSON.parse(
  fs.readFileSync(
    new URL("./insumos-importacao-21.json", import.meta.url),
    "utf8"
  )
);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`Itens recebidos: ${input.length}`);

await signInWithEmailAndPassword(
  auth,
  process.env.FIREBASE_USER_EMAIL,
  process.env.FIREBASE_USER_PASSWORD
);

console.log(`Autenticado como: ${auth.currentUser.email}`);

const existingSnap = await getDocs(collection(db, "insumos"));

const existingNames = new Set(
  existingSnap.docs.map((d) => normalizeName(d.data()?.name ?? ""))
);

const toCreate = input.filter(
  (item) => !existingNames.has(normalizeName(item.name))
);

console.log(`Já existentes: ${input.length - toCreate.length}`);
console.log(`Novos a criar: ${toCreate.length}`);

if (toCreate.length === 0) {
  console.log("Nada para importar.");
  process.exit(0);
}

const batch = writeBatch(db);

for (const item of toCreate) {
  const ref = doc(collection(db, "insumos"));

  batch.set(ref, {
    name: item.name,
    unit: item.unit,
    purchasePriceCents: Number(item.purchasePriceCents),
    purchaseQuantity: Number(item.purchaseQuantity),
    unitCostCents: computeUnitCostCents(
      Number(item.purchasePriceCents),
      Number(item.purchaseQuantity)
    ),
    stockQuantity: 0,
    active: true,
    createdAt: serverTimestamp(),
  });
}

await batch.commit();

console.log(`Importação concluída: ${toCreate.length} insumo(s) criado(s).`);
