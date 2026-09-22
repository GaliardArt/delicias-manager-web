import {
  collection,
  getDocs,
  DocumentReference,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";
import { assertCurrentAdmin } from "./users";

async function deleteDocsInChunks(refs: DocumentReference[], chunkSize = 400): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + chunkSize)) batch.delete(ref);
    await batch.commit();
    deleted += Math.min(chunkSize, refs.length - i);
  }
  return deleted;
}

export async function clearProducts(): Promise<number> {
  await assertCurrentAdmin();
  const snap = await getDocs(collection(db, "products"));
  return deleteDocsInChunks(snap.docs.map((d) => d.ref));
}

export async function clearInsumos(): Promise<number> {
  await assertCurrentAdmin();
  const snap = await getDocs(collection(db, "insumos"));
  return deleteDocsInChunks(snap.docs.map((d) => d.ref));
}

export async function clearIngredientes(): Promise<number> {
  await assertCurrentAdmin();
  const snap = await getDocs(collection(db, "ingredientes"));
  return deleteDocsInChunks(snap.docs.map((d) => d.ref));
}

export async function clearExpenses(): Promise<number> {
  await assertCurrentAdmin();
  const snap = await getDocs(collection(db, "expenses"));
  return deleteDocsInChunks(snap.docs.map((d) => d.ref));
}

export async function clearSales(): Promise<number> {
  await assertCurrentAdmin();
  const snap = await getDocs(collection(db, "sales"));
  let deleted = 0;

  for (const sale of snap.docs) {
    const paymentsSnap = await getDocs(collection(db, "sales", sale.id, "payments"));
    await deleteDocsInChunks([...paymentsSnap.docs.map((d) => d.ref), sale.ref]);
    deleted += 1;
  }
  return deleted;
}

export async function clearSalesDays(): Promise<number> {
  await assertCurrentAdmin();
  const snap = await getDocs(collection(db, "salesDays"));
  return deleteDocsInChunks(snap.docs.map((d) => d.ref));
}

export async function clearGeneralHistories(): Promise<{ activities: number; orders: number }> {
  await assertCurrentAdmin();
  const [activitiesSnap, ordersSnap] = await Promise.all([
    getDocs(collection(db, "activityHistory")),
    getDocs(collection(db, "orders")),
  ]);

  const historicalOrders = ordersSnap.docs.filter((d) => {
    const data = d.data();
    return data.status === "cancelada" || (data.status === "entregue" && Number(data.pendingCents ?? 0) <= 0);
  });

  await deleteDocsInChunks(activitiesSnap.docs.map((d) => d.ref));

  for (const order of historicalOrders) {
    const paymentsSnap = await getDocs(collection(db, "orders", order.id, "payments"));
    await deleteDocsInChunks([...paymentsSnap.docs.map((d) => d.ref), order.ref]);
  }

  return { activities: activitiesSnap.size, orders: historicalOrders.length };
}
