import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  location?: string;
  travelPace?: string;
  budgetTier?: string;
  currency?: string;
  dietary?: string;
  interests?: string[];
  countriesVisited?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TripActivity {
  id: string;
  time: string;
  title: string;
  description: string;
  rating?: string;
  reviewCount?: string;
  duration: string;
  transit?: string;
  imageUrl: string;
}

export interface FirestoreTrip {
  id: string;
  title: string;
  destination: string;
  dates: string;
  days: string;
  status: "Upcoming" | "Planning" | "Completed" | "Dreaming";
  budget: string;
  travelers: string;
  image: string;
  locations: string[];
  summary?: string;
  activities?: TripActivity[];
  daysData?: any[];
  highlights?: Array<{ title: string; image: string }>;
  expenses?: TripExpense[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TripExpense {
  id: string;
  title: string;
  category: "Accommodation" | "Meals" | "Transport" | "Attractions" | "Other";
  amount: number;
  date: string;
  notes?: string;
}

export interface FirestorePlan {
  id: string;
  query: string;
  title: string;
  destination: string;
  budget: string;
  duration: string;
  interests: string[];
  itinerarySummary: string;
  daysCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FirestoreSavedDestination {
  id: string;
  name: string;
  country: string;
  imageUrl: string;
  description: string;
  category: string;
  matchScore?: number;
  bestTimeToVisit?: string;
  tags: string[];
  savedAt: string;
}

// ── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function saveUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(
      userRef,
      {
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error saving user profile:", error);
    throw error;
  }
}

// ── Trips Management ─────────────────────────────────────────────────────────

export async function getUserTrips(uid: string): Promise<FirestoreTrip[]> {
  try {
    const tripsRef = collection(db, "users", uid, "trips");
    const snap = await getDocs(tripsRef);
    const trips: FirestoreTrip[] = [];
    snap.forEach((d) => {
      trips.push({ id: d.id, ...d.data() } as FirestoreTrip);
    });
    return trips;
  } catch (error) {
    console.error("Error fetching user trips:", error);
    return [];
  }
}

export async function getUserTrip(
  uid: string,
  tripId: string
): Promise<FirestoreTrip | null> {
  try {
    const tripRef = doc(db, "users", uid, "trips", tripId);
    const snap = await getDoc(tripRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as FirestoreTrip;
    }
    return null;
  } catch (error) {
    console.error("Error fetching trip:", error);
    return null;
  }
}

export async function saveUserTrip(
  uid: string,
  trip: FirestoreTrip
): Promise<void> {
  try {
    const tripRef = doc(db, "users", uid, "trips", trip.id);
    await setDoc(
      tripRef,
      {
        ...trip,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error saving user trip:", error);
    throw error;
  }
}

export async function deleteUserTrip(
  uid: string,
  tripId: string
): Promise<void> {
  try {
    const tripRef = doc(db, "users", uid, "trips", tripId);
    await deleteDoc(tripRef);
  } catch (error) {
    console.error("Error deleting user trip:", error);
    throw error;
  }
}

export async function removeSeededUserTrips(uid: string): Promise<void> {
  // Remove only the known sample records previously created by the old
  // first-login seeder. User-created trips are left untouched.
  const seededIds = ["kerala-escape", "japan-tradition", "santorini-sunsets"];
  await Promise.all(seededIds.map((tripId) => deleteDoc(doc(db, "users", uid, "trips", tripId))));
}

// ── Plans & AI Chat History ──────────────────────────────────────────────────

export async function getUserPlans(uid: string): Promise<FirestorePlan[]> {
  try {
    const plansRef = collection(db, "users", uid, "plans");
    const snap = await getDocs(plansRef);
    const plans: FirestorePlan[] = [];
    snap.forEach((d) => {
      plans.push({ id: d.id, ...d.data() } as FirestorePlan);
    });
    return plans;
  } catch (error) {
    console.error("Error fetching user plans:", error);
    return [];
  }
}

export async function saveUserPlan(
  uid: string,
  plan: FirestorePlan
): Promise<void> {
  try {
    const planRef = doc(db, "users", uid, "plans", plan.id);
    await setDoc(
      planRef,
      {
        ...plan,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error saving user plan:", error);
    throw error;
  }
}

export async function deleteUserPlan(
  uid: string,
  planId: string
): Promise<void> {
  try {
    const planRef = doc(db, "users", uid, "plans", planId);
    await deleteDoc(planRef);
  } catch (error) {
    console.error("Error deleting user plan:", error);
    throw error;
  }
}

// ── Saved Destinations (Wishlist) ────────────────────────────────────────────

export async function getUserSavedDestinations(
  uid: string
): Promise<FirestoreSavedDestination[]> {
  try {
    const savedRef = collection(db, "users", uid, "saved");
    const snap = await getDocs(savedRef);
    const items: FirestoreSavedDestination[] = [];
    snap.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as FirestoreSavedDestination);
    });
    return items;
  } catch (error) {
    console.error("Error fetching saved destinations:", error);
    return [];
  }
}

export async function saveUserDestination(
  uid: string,
  destination: FirestoreSavedDestination
): Promise<void> {
  try {
    const destRef = doc(db, "users", uid, "saved", destination.id);
    await setDoc(destRef, {
      ...destination,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error saving destination:", error);
    throw error;
  }
}

export async function removeUserDestination(
  uid: string,
  destinationId: string
): Promise<void> {
  try {
    const destRef = doc(db, "users", uid, "saved", destinationId);
    await deleteDoc(destRef);
  } catch (error) {
    console.error("Error removing saved destination:", error);
    throw error;
  }
}

export async function isDestinationSaved(
  uid: string,
  destinationId: string
): Promise<boolean> {
  try {
    const destRef = doc(db, "users", uid, "saved", destinationId);
    const snap = await getDoc(destRef);
    return snap.exists();
  } catch {
    return false;
  }
}
