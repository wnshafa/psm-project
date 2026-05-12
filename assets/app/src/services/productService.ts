import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
// Import the Product type you just created in Step 1!
import { Product } from "../types";

export const getAllProducts = async (): Promise<Product[]> => {
  try {
    const snapshot = await getDocs(collection(db, "products"));

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Product)); // <--- Cast the data to 'Product' here
    
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
};