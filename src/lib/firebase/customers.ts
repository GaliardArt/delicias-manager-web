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
import { Customer } from "@/types";
import { logActivity } from "./activity";

// Leitura só dos clientes ativos — usado no formulário de venda (Fase 3).
// Ordena no cliente (não no Firestore) para não depender de um índice composto
// (active + name) que exigiria um passo manual no Console do Firebase.
export async function listActiveCustomers(): Promise<Customer[]> {
  const q = query(collection(db, "customers"), where("active", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as Customer))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Lista todos os clientes (ativos e inativos) para a tela de gestão de clientes.
export async function listAllCustomers(): Promise<Customer[]> {
  const q = query(collection(db, "customers"), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const snap = await getDoc(doc(db, "customers", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Customer;
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
  await logActivity("cliente_cadastrado", `Novo cliente cadastrado: ${input.name}`, ref.id);
  return ref.id;
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<void> {
  await updateDoc(doc(db, "customers", id), { ...input });
}

export async function setCustomerActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "customers", id), { active });
}
