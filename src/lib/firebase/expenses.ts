import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { Expense } from "@/types";

interface ExpenseInput {
  description: string;
  category: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
}

export async function createExpense(input: ExpenseInput): Promise<string> {
  const ref = await addDoc(collection(db, "expenses"), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
}

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

// Lista todas as contas — o filtro por período é feito no cliente (mesmo
// padrão de src/lib/firebase/reports.ts), já que o volume de uma confeitaria
// pequena não justifica consultas por período no Firestore.
export async function listAllExpenses(): Promise<Expense[]> {
  const q = query(collection(db, "expenses"), orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      description: data.description,
      category: data.category,
      amountCents: data.amountCents,
      date: data.date,
      createdAt: tsToIso(data.createdAt),
    };
  });
}
