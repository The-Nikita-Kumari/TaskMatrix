// src/lib/auth.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  mobile: string;
  company: string;
}

export async function registerUser(data: RegisterData) {
  const { firstName, lastName, email, password, mobile, company } = data;

  // Create Firebase Auth user
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Set display name
  await updateProfile(user, {
    displayName: `${firstName} ${lastName}`,
  });

  // Save extended profile to Firestore
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    email,
    mobile,
    company,
    createdAt: serverTimestamp(),
  });

  return user;
}

export async function loginUser(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logoutUser() {
  await signOut(auth);
}
