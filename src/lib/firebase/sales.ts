import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "./config";
import { Payment, PaymentMethod, Sale, SaleItem } from "@/types";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

interface CreateSaleInput {
  customerId: string;
  customerName: string;
  items: SaleItem[];
  totalCents: number;
  /** Pagamento já recebido no ato da venda (0 para fiado total). */
  initialPaymentCents: number;
  initialPaymentMethod: PaymentMethod;
}

// Cria a venda e, se houver valor pago no ato, o primeiro pagamento — tudo em
// um único batch atômico, para nunca deixar uma venda "pela metade" (seção 21).
// customerId pode vir vazio para vendas avulsas (cliente não cadastrado).
export async function createSale(input: CreateSaleInput): Promise<string> {
  const { customerId, customerName, items, totalCents, initialPaymentCents, initialPaymentMethod } =
    input;

  if (items.length === 0) {
    throw new Error("A venda precisa ter ao menos um produto.");
  }
  if (initialPaymentCents > totalCents) {
    throw new Error("O valor pago não pode ser maior que o total da venda.");
  }

  const batch = writeBatch(db);
  const saleRef = doc(collection(db, "sales"));
  const pendingCents = totalCents - initialPaymentCents;

  batch.set(saleRef, {
    customerId,
    customerName,
    items,
    totalCents,
    paidCents: initialPaymentCents,
    pendingCents,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
  });

  if (initialPaymentCents > 0) {
    const paymentRef = doc(collection(saleRef, "payments"));
    batch.set(paymentRef, {
      amountCents: initialPaymentCents,
      method: initialPaymentMethod,
      paidAt: serverTimestamp(),
    });
  }

  const activityRef = doc(collection(db, "activityHistory"));
  batch.set(activityRef, {
    type: "venda_criada",
    description: `Venda registrada para ${customerName}`,
    referenceId: saleRef.id,
    userId: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return saleRef.id;
}

export interface SaleListItem {
  id: string;
  customerName: string;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  createdAt: string;
  itemsCount: number;
}

// Lista as vendas mais recentes. Filtros mais elaborados (período, forma de
// pagamento) ficam para quando houver necessidade real de escalar (seção 28).
export async function listRecentSales(max = 100): Promise<SaleListItem[]> {
  const q = query(collection(db, "sales"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, max).map((d) => {
    const data = d.data();
    return {
      id: d.id,
      customerName: data.customerName,
      totalCents: data.totalCents,
      paidCents: data.paidCents,
      pendingCents: data.pendingCents,
      createdAt: tsToIso(data.createdAt),
      itemsCount: Array.isArray(data.items) ? data.items.length : 0,
    };
  });
}

export async function getSaleWithPayments(saleId: string): Promise<Sale | null> {
  const saleSnap = await getDoc(doc(db, "sales", saleId));
  if (!saleSnap.exists()) return null;
  const data = saleSnap.data();

  const paymentsSnap = await getDocs(
    query(collection(db, "sales", saleId, "payments"), orderBy("paidAt", "asc"))
  );
  const payments: Payment[] = paymentsSnap.docs.map((p) => {
    const pd = p.data();
    return {
      id: p.id,
      amountCents: pd.amountCents,
      method: pd.method,
      paidAt: tsToIso(pd.paidAt),
      notes: pd.notes,
    };
  });

  return {
    id: saleSnap.id,
    customerId: data.customerId,
    customerName: data.customerName,
    items: data.items ?? [],
    totalCents: data.totalCents,
    paidCents: data.paidCents,
    pendingCents: data.pendingCents,
    payments,
    salesDayId: data.salesDayId,
    createdAt: tsToIso(data.createdAt),
  };
}

// Registra um novo pagamento sobre uma venda já existente (fiado quitado
// depois, pagamento parcial complementado, etc). Roda em transação para que
// paidCents/pendingCents nunca fiquem inconsistentes com a soma real dos
// pagamentos, mesmo com dois usuários registrando ao mesmo tempo.
export async function addPayment(
  saleId: string,
  amountCents: number,
  method: PaymentMethod
): Promise<void> {
  if (amountCents <= 0) {
    throw new Error("O valor do pagamento precisa ser maior que zero.");
  }

  await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) {
      throw new Error("Venda não encontrada.");
    }
    const sale = saleSnap.data();
    const currentPaid: number = sale.paidCents;
    const total: number = sale.totalCents;
    const newPaid = currentPaid + amountCents;

    if (newPaid > total) {
      throw new Error("Esse pagamento deixaria o valor pago maior que o total da venda.");
    }

    const paymentRef = doc(collection(saleRef, "payments"));
    transaction.set(paymentRef, {
      amountCents,
      method,
      paidAt: serverTimestamp(),
    });

    transaction.update(saleRef, {
      paidCents: newPaid,
      pendingCents: total - newPaid,
    });

    const activityRef = doc(collection(db, "activityHistory"));
    transaction.set(activityRef, {
      type: "pagamento_recebido",
      description: `Pagamento de ${(amountCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })} recebido de ${sale.customerName}`,
      referenceId: saleId,
      userId: auth.currentUser?.uid ?? null,
      createdAt: serverTimestamp(),
    });
  });
}
