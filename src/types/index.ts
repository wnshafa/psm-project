import { Timestamp } from "firebase/firestore";

// --- USER & CLIENT PROFILES ---
export interface UserData {
  id: string;
  email?: string;
  fullName?: string;
  name?: string;
  role?: string;
  routineName?: string;
  streak?: number;
  totalCompleted?: number;
  dailyAdherence?: number;
  updatedAt?: Timestamp;
  skinType?: string;
  skinConcern?: string | string[];
  age?: string;
  phoneNumber?: string;
}

export interface SkinProfile {
  skinType?: string | string[];
  skinConcern?: string | string[];
}

export interface Stats {
  totalCompleted: number;
  streak: number;
  lastRoutine: string;
}

// --- PRODUCTS ---
export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  skinConcern?: string | string[];
  skinType?: string | string[];
  activeIngredients?: string[];
  price?: number | string;
  originalPrice?: number | string;
  rating?: number | string;
  reviewCount?: number | string;
}

export interface SavedProduct {
  id: string;
  userId: string;
  productId: string;
  savedAt: Timestamp;
}

// --- ROUTINES ---
export interface RoutineStep {
  title: string;
  instructions: string;
}

export interface Routine {
  id: string;
  clientId: string;
  type: "Morning" | "Night";
  duration?: string;
  description?: string;
  assignedDate?: Timestamp;
  steps: RoutineStep[];
}

// --- LOGS & TRACKING ---
export interface RoutineLog {
  id: string;
  clientId: string;
  routineID: string;
  type: string;
  status: string;
  mood?: string;
  notes?: string;
  adherenceAtLog?: number;
  logDate: Timestamp;
}

export interface SkinPhoto {
  id: string;
  userId: string;
  imageUrl: string;
  date: Timestamp;
  note?: string;
  consultantFeedback?: string;
  feedbackDate?: Timestamp;
}

export interface UserLog {
  id: string;
  userId: string;
  logType: string;
  logDate: Timestamp;
  details?: string;
}

// --- REMINDERS ---
export interface ReminderLog {
  id: string;
  clientID: string;
  clientName: string;
  templateID?: string;
  templateTitle: string;
  message?: string;
  userId?: string;
  date: Timestamp;
  status: string;
}

export interface ReminderTemplate {
  id: string;
  title: string;
  message: string;
  userId?: string;
  createdAt?: Timestamp;
}

export interface Reminder {
  id: string;
  clientId: string;
  templateId: string;
  date: Timestamp;
  status: string;
  message?: string;
  userId?: string;
}

export interface ReminderWithTemplate extends Reminder {
  template: ReminderTemplate;
}
