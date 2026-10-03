import {
  addDoc,
  collection,
  DocumentData,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { Expense, ExpenseKind, ExpenseRecurrence, ExpenseStatus } from "@/types";

export const EXPENSE_CATEGORIES = [
  "Insumos",
  "Embalagens",
  "Transporte",
  "Energia",
  "Água",
  "Aluguel",
  "Equipamentos",
  "Manutenção",
  "Marketing",
  "Funcionários",
  "Impostos",
  "Outros",
] as const;

export interface ExpenseInput {
  description: string;
  category: string;
  amountCents: number;
  date: string;
  dueDate?: string;
  paidAt?: string;
  kind?: ExpenseKind;
  status?: ExpenseStatus;
  recurrence?: ExpenseRecurrence;
  notes?: string;
}

function buildExpensePayload(input: ExpenseInput): Record<string, unknown> {
  return {
    description: input.description.trim(),
    category: input.category.trim() || "Outros",
    amountCents: input.amountCents,
    date: input.date,
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    ...(input.paidAt ? { paidAt: input.paidAt } : {}),
    kind: input.kind ?? "variavel",
    status: input.status ?? "pago",
    recurrence: input.recurrence ?? "nenhuma",
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };
}

export async function createExpense(input: ExpenseInput): Promise<string> {
  const ref = await addDoc(collection(db, "expenses"), {
    ...buildExpensePayload(input),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateExpense(
  id: string,
  input: ExpenseInput
): Promise<void> {
  await updateDoc(doc(db, "expenses", id), buildExpensePayload(input));
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
}

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

function normalizeExpenseStatus(value: unknown): ExpenseStatus {
  return value === "pendente" ? "pendente" : "pago";
}

function normalizeExpenseKind(value: unknown): ExpenseKind {
  return value === "fixa" ? "fixa" : "variavel";
}

function normalizeExpenseRecurrence(value: unknown): ExpenseRecurrence {
  if (value === "semanal" || value === "mensal" || value === "anual") {
    return value;
  }
  return "nenhuma";
}

function mapExpenses(snapshot: QuerySnapshot<DocumentData>): Expense[] {
  return snapshot.docs.map((d) => {
    const data = d.data();
    const status = normalizeExpenseStatus(data.status);

    return {
      id: d.id,
      description: String(data.description ?? ""),
      category: String(data.category ?? "Outros"),
      amountCents: Number(data.amountCents ?? 0),
      date: String(data.date ?? ""),
      dueDate: String(data.dueDate ?? data.date ?? ""),
      paidAt:
        typeof data.paidAt === "string"
          ? data.paidAt
          : status === "pago"
            ? String(data.date ?? "")
            : undefined,
      kind: normalizeExpenseKind(data.kind),
      status,
      recurrence: normalizeExpenseRecurrence(data.recurrence),
      notes: typeof data.notes === "string" ? data.notes : undefined,
      createdAt: tsToIso(data.createdAt),
    };
  });
}

export async function listExpensesForDateRange(startDate: string, endDate: string): Promise<Expense[]> {
  const q = query(
    collection(db, "expenses"),
    where("date", ">=", startDate),
    where("date", "<", endDate),
    orderBy("date", "desc")
  );
  const snapshot = await getDocs(q);
  return mapExpenses(snapshot);
}

// Mantida para telas que precisam consultar o histórico completo.
export async function listAllExpenses(): Promise<Expense[]> {
  const snapshot = await getDocs(query(collection(db, "expenses"), orderBy("date", "desc")));
  return mapExpenses(snapshot);
}

export function isExpenseOverdue(expense: Expense, today: string): boolean {
  return expense.status === "pendente" && Boolean(expense.dueDate) && expense.dueDate! < today;
}
