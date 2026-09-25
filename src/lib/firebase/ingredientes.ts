import {
  addDoc,
  collection,
  deleteDoc,
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
import { Ingrediente, Insumo, RecipeItem } from "@/types";
import { resolveIngredienteUnitCost, toInsumosMap, toIngredientesMap } from "@/lib/costing";

/**
 * Sempre calcula o custo atual dos ingredientes a partir dos insumos e
 * ingredientes existentes no Firestore. O campo unitCostCents salvo no
 * documento é tratado como valor derivado/cache e nunca como fonte de verdade.
 *
 * Isso garante que uma alteração de preço de um insumo seja refletida
 * imediatamente em ingredientes que usam esse insumo, inclusive quando
 * existem ingredientes dentro de ingredientes.
 */
async function loadIngredientesWithCurrentCost(activeOnly = false): Promise<Ingrediente[]> {
  const [ingredientesSnap, insumosSnap] = await Promise.all([
    getDocs(query(collection(db, "ingredientes"), orderBy("name", "asc"))),
    getDocs(query(collection(db, "insumos"), orderBy("name", "asc"))),
  ]);

  const ingredientes = ingredientesSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as Ingrediente)
  );
  const insumos = insumosSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as Insumo)
  );

  const insumosById = toInsumosMap(insumos);
  const ingredientesById = toIngredientesMap(ingredientes);

  const current = ingredientes.map((ingrediente) => ({
    ...ingrediente,
    unitCostCents: resolveIngredienteUnitCost(
      ingrediente,
      insumosById,
      ingredientesById
    ),
  }));

  return activeOnly ? current.filter((ingrediente) => ingrediente.active) : current;
}

export async function listActiveIngredientes(): Promise<Ingrediente[]> {
  return loadIngredientesWithCurrentCost(true);
}

export async function listAllIngredientes(): Promise<Ingrediente[]> {
  return loadIngredientesWithCurrentCost(false);
}

export async function getIngrediente(id: string): Promise<Ingrediente | null> {
  const ingredientes = await loadIngredientesWithCurrentCost(false);
  return ingredientes.find((ingrediente) => ingrediente.id === id) ?? null;
}

interface IngredienteInput {
  name: string;
  yieldQuantity: number;
  yieldUnit: string;
  recipeItems: RecipeItem[];
}

// Recebe os insumos/ingredientes já carregados (a tela sempre tem essas listas
// em mãos para montar a receita) para calcular o custo sem outra leitura.
function computeCost(
  input: IngredienteInput,
  insumos: Insumo[],
  existingIngredientes: Ingrediente[],
  selfId?: string
): number {
  const insumosById = toInsumosMap(insumos);
  const ingredientesById = toIngredientesMap(existingIngredientes);
  const draft: Ingrediente = {
    id: selfId ?? "__draft__",
    name: input.name,
    yieldQuantity: input.yieldQuantity,
    yieldUnit: input.yieldUnit,
    recipeItems: input.recipeItems,
    unitCostCents: 0,
    stockQuantity: 0,
    active: true,
    createdAt: "",
  };
  return resolveIngredienteUnitCost(draft, insumosById, ingredientesById);
}

export async function createIngrediente(
  input: IngredienteInput,
  insumos: Insumo[],
  existingIngredientes: Ingrediente[]
): Promise<string> {
  const unitCostCents = computeCost(input, insumos, existingIngredientes);
  const ref = await addDoc(collection(db, "ingredientes"), {
    ...input,
    unitCostCents,
    stockQuantity: 0,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateIngrediente(
  id: string,
  input: IngredienteInput,
  insumos: Insumo[],
  existingIngredientes: Ingrediente[]
): Promise<void> {
  const unitCostCents = computeCost(input, insumos, existingIngredientes, id);
  await updateDoc(doc(db, "ingredientes", id), { ...input, unitCostCents });
}

export async function deleteIngrediente(id: string): Promise<void> {
  await deleteDoc(doc(db, "ingredientes", id));
}

export async function setIngredienteActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "ingredientes", id), { active });
}

export async function adjustIngredienteStock(id: string, delta: number): Promise<void> {
  await updateDoc(doc(db, "ingredientes", id), { stockQuantity: increment(delta) });
}
