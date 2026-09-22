import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { Product, RecipeItem } from "@/types";

// Normaliza documentos antigos (de antes da receita/estoque existirem) com
// valores padrão, em vez de deixar `undefined` vazar pro resto do app.
function mapProductDoc(id: string, data: DocumentData): Product {
  return {
    id,
    name: data.name,
    category: data.category,
    priceCents: data.priceCents,
    unit: data.unit,
    yieldQuantity: data.yieldQuantity ?? 1,
    description: data.description,
    active: data.active,
    createdAt: data.createdAt,
    recipeItems: data.recipeItems ?? [],
    stockQuantity: data.stockQuantity ?? 0,
  };
}

// Leitura só dos produtos ativos — usado no formulário de venda (Fase 3).
// Ordena no cliente (não no Firestore) pelo mesmo motivo do customers.ts.
export async function listActiveProducts(): Promise<Product[]> {
  const q = query(collection(db, "products"), where("active", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => mapProductDoc(d.id, d.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Lista todos os produtos (ativos e inativos) para a tela de gestão de produtos.
export async function listAllProducts(): Promise<Product[]> {
  const q = query(collection(db, "products"), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => mapProductDoc(d.id, d.data()));
}

export async function getProduct(id: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, "products", id));
  if (!snap.exists()) return null;
  return mapProductDoc(snap.id, snap.data());
}

interface ProductInput {
  name: string;
  category: string;
  priceCents: number;
  unit: string;
  yieldQuantity: number;
  description?: string;
  recipeItems: RecipeItem[];
}

export async function createProduct(input: ProductInput): Promise<string> {
  const ref = await addDoc(collection(db, "products"), {
    ...input,
    stockQuantity: 0,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  await updateDoc(doc(db, "products", id), { ...input });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, "products", id));
}

export async function setProductActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "products", id), { active });
}

// Ajuste manual de estoque (contagem, produção, perda). Aceita negativo.
export async function adjustProductStock(id: string, delta: number): Promise<void> {
  await updateDoc(doc(db, "products", id), { stockQuantity: increment(delta) });
}
