import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { Product } from "@/types";

// Leitura só dos produtos ativos — usado no formulário de venda (Fase 3).
// Ordena no cliente (não no Firestore) pelo mesmo motivo do customers.ts.
export async function listActiveProducts(): Promise<Product[]> {
  const q = query(collection(db, "products"), where("active", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as Product))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Lista todos os produtos (ativos e inativos) para a tela de gestão de produtos.
export async function listAllProducts(): Promise<Product[]> {
  const q = query(collection(db, "products"), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
}

export async function getProduct(id: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, "products", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Product;
}

interface ProductInput {
  name: string;
  category: string;
  priceCents: number;
  unit: string;
  description?: string;
}

export async function createProduct(input: ProductInput): Promise<string> {
  const ref = await addDoc(collection(db, "products"), {
    ...input,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  await updateDoc(doc(db, "products", id), { ...input });
}

export async function setProductActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "products", id), { active });
}
