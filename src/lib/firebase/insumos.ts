import {
  addDoc,
  collection,
  doc,
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
import { Insumo } from "@/types";

export async function listActiveInsumos(): Promise<Insumo[]> {
  const q = query(collection(db, "insumos"), where("active", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as Insumo))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAllInsumos(): Promise<Insumo[]> {
  const q = query(collection(db, "insumos"), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Insumo));
}

export async function getInsumo(id: string): Promise<Insumo | null> {
  const snap = await getDoc(doc(db, "insumos", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Insumo;
}

interface InsumoInput {
  name: string;
  unit: string;
  purchasePriceCents: number;
  purchaseQuantity: number;
  packageUnit?: string;
  packageQuantity?: number;
}

function computeUnitCostCents(purchasePriceCents: number, purchaseQuantity: number): number {
  if (purchaseQuantity <= 0) return 0;
  return purchasePriceCents / purchaseQuantity;
}

// Firestore rejeita campos com valor `undefined` — quando a conversão
// personalizada não é usada, esses campos simplesmente não são gravados
// (em vez de gravar `null`/`undefined`).
function packageFields(input: InsumoInput): Record<string, string | number> {
  if (input.packageUnit && input.packageQuantity && input.packageQuantity > 0) {
    return { packageUnit: input.packageUnit, packageQuantity: input.packageQuantity };
  }
  return {};
}

export async function createInsumo(input: InsumoInput): Promise<string> {
  const { packageUnit, packageQuantity, ...rest } = input;
  const ref = await addDoc(collection(db, "insumos"), {
    ...rest,
    ...packageFields(input),
    unitCostCents: computeUnitCostCents(input.purchasePriceCents, input.purchaseQuantity),
    stockQuantity: 0,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Edita nome/unidade/preço-base, sem mexer no estoque (isso é via
// registerPurchase ou adjustStock). Recalcula o custo por unidade.
export async function updateInsumo(id: string, input: InsumoInput): Promise<void> {
  const { packageUnit, packageQuantity, ...rest } = input;
  await updateDoc(doc(db, "insumos", id), {
    ...rest,
    // Se o usuário removeu a conversão personalizada, `deleteField()` limparia
    // de vez; como packageFields() já omite quando não usada, usamos objeto
    // vazio explícito para os dois campos ficarem consistentes no update.
    packageUnit: packageUnit && packageQuantity && packageQuantity > 0 ? packageUnit : null,
    packageQuantity: packageUnit && packageQuantity && packageQuantity > 0 ? packageQuantity : null,
    unitCostCents: computeUnitCostCents(input.purchasePriceCents, input.purchaseQuantity),
  });
}

export async function setInsumoActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "insumos", id), { active });
}

// Registrar uma nova compra: atualiza o custo por unidade (com base no preço
// pago dessa vez) e soma ao estoque.
export async function registerInsumoPurchase(
  id: string,
  purchasePriceCents: number,
  purchaseQuantity: number
): Promise<void> {
  await updateDoc(doc(db, "insumos", id), {
    purchasePriceCents,
    purchaseQuantity,
    unitCostCents: computeUnitCostCents(purchasePriceCents, purchaseQuantity),
    stockQuantity: increment(purchaseQuantity),
  });
}

// Ajuste manual de estoque (contagem, perda, produção etc). Aceita negativo.
export async function adjustInsumoStock(id: string, delta: number): Promise<void> {
  await updateDoc(doc(db, "insumos", id), { stockQuantity: increment(delta) });
}
