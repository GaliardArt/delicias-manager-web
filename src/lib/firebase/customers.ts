import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  QueryDocumentSnapshot,
  query,
  startAfter,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./config";
import { Customer } from "@/types";
import { logActivity } from "./activity";
import { FirestorePage, readThroughCache } from "./read-cache";

const customerCache = new Map<string, Customer[]>();
const customerRequests = new Map<string, Promise<Customer[]>>();
let customerCacheGeneration = 0;

export function invalidateCustomersCache(): void {
  customerCacheGeneration += 1;
  customerCache.clear();
  customerRequests.clear();
}

export function primeCustomersCache(customers: Customer[]): void {
  const cacheKey = auth.currentUser?.uid ?? "anonymous";
  customerCache.set(cacheKey, customers);
}

function updateCachedCustomer(id: string, customer: Customer | null): void {
  customerCacheGeneration += 1;
  customerRequests.clear();
  for (const [key, cached] of customerCache) {
    const next = cached.filter((item) => item.id !== id);
    if (customer) next.push(customer);
    next.sort((a, b) => a.name.localeCompare(b.name));
    customerCache.set(key, next);
  }
}

// Leitura só dos clientes ativos — usado no formulário de venda (Fase 3).
// Ordena no cliente (não no Firestore) para não depender de um índice composto
// (active + name) que exigiria um passo manual no Console do Firebase.
export async function listActiveCustomers(): Promise<Customer[]> {
  return readThroughCache("customers/active", async () => {
    const q = query(collection(db, "customers"), where("active", "==", true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)).sort((a, b) => a.name.localeCompare(b.name));
  });
}

// Lista todos os clientes (ativos e inativos) para a tela de gestão de clientes.
export async function listAllCustomers(): Promise<Customer[]> {
  const cacheKey = auth.currentUser?.uid ?? "anonymous";
  const cached = customerCache.get(cacheKey);
  if (cached) return cached;
  const pending = customerRequests.get(cacheKey);
  if (pending) return pending;

  const q = query(collection(db, "customers"), orderBy("name", "asc"));
  const generation = customerCacheGeneration;
  const request = getDocs(q).then((snapshot) => {
    const customers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
    if (generation === customerCacheGeneration) {
      customerCache.set(cacheKey, customers);
    }
    return customers;
  }).finally(() => {
    if (customerRequests.get(cacheKey) === request) customerRequests.delete(cacheKey);
  });
  customerRequests.set(cacheKey, request);
  return request;
}

export async function listCustomersPage(
  cursor: QueryDocumentSnapshot | null,
  pageSize = 25
): Promise<FirestorePage<Customer, QueryDocumentSnapshot>> {
  const cursorKey = cursor?.id ?? "first";
  return readThroughCache(`customers/page/${cursorKey}/${pageSize}`, async () => {
    const constraints = [orderBy("name", "asc"), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize + 1)];
    const snapshot = await getDocs(query(collection(db, "customers"), ...constraints));
    const docs = snapshot.docs.slice(0, pageSize);
    return {
      items: docs.map((d) => ({ id: d.id, ...d.data() } as Customer)),
      hasMore: snapshot.docs.length > pageSize,
      nextCursor: docs[docs.length - 1] ?? null,
    };
  });
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return readThroughCache(`customers/${id}`, async () => {
    const snap = await getDoc(doc(db, "customers", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Customer;
  });
}

interface CustomerInput {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
}

export async function createCustomer(input: CustomerInput): Promise<string> {
  const ref = await addDoc(collection(db, "customers"), {
    ...input,
    active: true,
    createdAt: serverTimestamp(),
  });
  updateCachedCustomer(ref.id, {
    id: ref.id,
    ...input,
    active: true,
    createdAt: new Date().toISOString(),
  });
  await logActivity("cliente_cadastrado", `Novo cliente cadastrado: ${input.name}`, ref.id);
  return ref.id;
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<void> {
  await updateDoc(doc(db, "customers", id), { ...input });
  const existing = Array.from(customerCache.values())
    .flatMap((cached) => cached)
    .find((item) => item.id === id);
  if (existing) updateCachedCustomer(id, { ...existing, ...input });
  else invalidateCustomersCache();
}

export async function deleteCustomer(id: string): Promise<void> {
  await deleteDoc(doc(db, "customers", id));
  updateCachedCustomer(id, null);
}

export async function setCustomerActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "customers", id), { active });
  const existing = Array.from(customerCache.values())
    .flatMap((cached) => cached)
    .find((item) => item.id === id);
  if (existing) updateCachedCustomer(id, { ...existing, active });
  else invalidateCustomersCache();
}
