import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from "firebase/auth";
import { auth } from "./config";

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function syncCurrentUserDisplayName(name: string): Promise<void> {
  const user = auth.currentUser;
  const normalizedName = name.trim();
  if (!user || !normalizedName || user.displayName === normalizedName) return;

  await updateProfile(user, { displayName: normalizedName });
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}
