import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./config";
import { ActivityType } from "@/types";

// Registra um evento de auditoria (seção 22 da spec). A coleção activityHistory
// é apenas de criação — nunca alterada ou apagada (ver firestore.rules).
export async function logActivity(
  type: ActivityType,
  description: string,
  referenceId: string
): Promise<void> {
  await addDoc(collection(db, "activityHistory"), {
    type,
    description,
    referenceId,
    userId: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
  });
}
