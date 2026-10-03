import {
  addDoc,
  collection,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  QueryDocumentSnapshot,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { ExtraCostMode, Product, RecipeItem } from "@/types";
import { FirestorePage, readThroughCache } from "./read-cache";

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
    yieldWeightGrams: data.yieldWeightGrams ?? 0,
    description: data.description,
    active: data.active,
    createdAt: data.createdAt,
    recipeItems: data.recipeItems ?? [],
    stockQuantity: data.stockQuantity ?? 0,
    // Produtos cadastrados antes do custo adicional existir não têm esses campos.
    extraCostCents: Number(data.extraCostCents ?? 0),
    extraCostMode: data.extraCostMode === "receita" ? "receita" : "unidade",
    extraCostPct: Math.max(0, Number(data.extraCostPct ?? 0)),
  };
}

// Leitura só dos produtos ativos — usado no formulário de venda (Fase 3).
// Ordena no cliente (não no Firestore) pelo mesmo motivo do customers.ts.
export async function listActiveProducts(): Promise<Product[]> {
  return readThroughCache("products/active", async () => {
    const q = query(collection(db, "products"), where("active", "==", true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapProductDoc(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
  });
}

// Lista todos os produtos (ativos e inativos) para a tela de gestão de produtos.
export async function listAllProducts(): Promise<Product[]> {
  return readThroughCache("products/all", async () => {
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapProductDoc(d.id, d.data()));
  });
}

export async function listProductsPage(
  cursor: QueryDocumentSnapshot | null,
  pageSize = 25
): Promise<FirestorePage<Product, QueryDocumentSnapshot>> {
  const cursorKey = cursor?.id ?? "first";
  return readThroughCache(`products/page/${cursorKey}/${pageSize}`, async () => {
    const constraints = [orderBy("name", "asc"), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize + 1)];
    const snapshot = await getDocs(query(collection(db, "products"), ...constraints));
    const docs = snapshot.docs.slice(0, pageSize);
    return {
      items: docs.map((d) => mapProductDoc(d.id, d.data())),
      hasMore: snapshot.docs.length > pageSize,
      nextCursor: docs[docs.length - 1] ?? null,
    };
  });
}

export async function getProduct(id: string): Promise<Product | null> {
  return readThroughCache(`products/${id}`, async () => {
    const snap = await getDoc(doc(db, "products", id));
    if (!snap.exists()) return null;
    return mapProductDoc(snap.id, snap.data());
  });
}

interface ProductInput {
  name: string;
  category: string;
  priceCents: number;
  unit: string;
  yieldQuantity: number;
  yieldWeightGrams: number;
  description?: string;
  recipeItems: RecipeItem[];
  extraCostCents: number;
  extraCostMode: ExtraCostMode;
  extraCostPct: number;
}

function normalizeExtraCost(input: ProductInput) {
  return {
    extraCostCents: Math.max(0, Math.round(input.extraCostCents || 0)),
    extraCostMode: input.extraCostMode === "receita" ? "receita" : "unidade",
    extraCostPct: Math.max(0, Number(input.extraCostPct || 0)),
  };
}

export async function createProduct(input: ProductInput): Promise<string> {
  const ref = await addDoc(collection(db, "products"), {
    ...input,
    ...normalizeExtraCost(input),
    yieldWeightGrams: Math.max(0, input.yieldWeightGrams || 0),
    stockQuantity: 0,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  await updateDoc(doc(db, "products", id), {
    ...input,
    ...normalizeExtraCost(input),
    yieldWeightGrams: Math.max(0, input.yieldWeightGrams || 0),
  });
}

export async function setProductActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "products", id), { active });
}

// Ajuste manual de estoque (contagem, produção, perda). Aceita negativo.
export async function adjustProductStock(id: string, delta: number): Promise<void> {
  await updateDoc(doc(db, "products", id), { stockQuantity: increment(delta) });
}
