import { collection, getDocs } from "firebase/firestore"
import { db } from "../lib/firebase"

export const getAllProducts = async () => {
  try {
    const snapshot = await getDocs(collection(db, "products"))

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    console.error("Error fetching products:", error)
    return []
  }
}