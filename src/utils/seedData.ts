import { addDoc, collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase'; // Adjust to your actual Firebase config path

export const seedDemonstrationData = async () => {
  try {
    console.log("Starting data seeding...");

    // 1. Create a Demo Client User
    const demoUserId = "demo-client-001";
    await setDoc(doc(db, 'users', demoUserId), {
      uid: demoUserId,
      name: "Siti Nurhaliza (Demo)",
      email: "siti.demo@prestigemy.com",
      role: "client",
      skinType: "Oily",
      skinConcern: "Acne",
      createdAt: Timestamp.now(),
    });

    // 2. Add Fake Skin Analysis History (Showing improvement over 3 weeks)
    // We create past dates by subtracting milliseconds (1 day = 86400000 ms)
    const now = new Date();
    const skinRef = collection(db, 'users', demoUserId, 'skinAnalysis');

    const historicalAnalyses = [
      { daysAgo: 21, hydration: 40, oiliness: 85, sensitivity: 60, brightness: 50 }, // Week 1: Bad
      { daysAgo: 14, hydration: 55, oiliness: 70, sensitivity: 50, brightness: 60 }, // Week 2: Better
      { daysAgo: 7,  hydration: 75, oiliness: 55, sensitivity: 40, brightness: 75 }, // Week 3: Good
      { daysAgo: 0,  hydration: 85, oiliness: 40, sensitivity: 30, brightness: 85 }, // Today: Great
    ];

    for (const record of historicalAnalyses) {
      const recordDate = new Date(now.getTime() - record.daysAgo * 86400000);
      await addDoc(skinRef, {
        hydration: record.hydration,
        oiliness: record.oiliness,
        sensitivity: record.sensitivity,
        brightness: record.brightness,
        analyzedAt: Timestamp.fromDate(recordDate),
      });
    }

    // 3. Assign a Routine to the Demo User
    const routinesRef = collection(db, 'users', demoUserId, 'routines');
    const routineSteps = [
      { stepName: "Gentle Foaming Cleanser", sequenceIndex: 1, instructions: "Wash for 60 seconds." },
      { stepName: "Niacinamide Serum", sequenceIndex: 2, instructions: "Apply 3 drops." },
      { stepName: "Oil-Free Moisturizer", sequenceIndex: 3, instructions: "Massage into face." },
      { stepName: "SPF 50 Sunscreen", sequenceIndex: 4, instructions: "Apply two finger lengths." },
    ];

    const stepIds = [];
    for (const step of routineSteps) {
      const docRef = await addDoc(routinesRef, {
        ...step,
        assignedAt: Timestamp.now(),
      });
      stepIds.push(docRef.id);
    }

    // 4. Add Fake Routine Logs for the last 5 days
    const logsRef = collection(db, 'logs');
    
    // Simulate high adherence (they completed most steps over the last 5 days)
    for (let i = 4; i >= 0; i--) {
      const logDate = new Date(now.getTime() - i * 86400000);
      
      // Complete all steps except maybe skip sunscreen on one day
      for (const stepId of stepIds) {
        if (i === 2 && stepId === stepIds[3]) continue; // Skipped SPF 2 days ago

        await addDoc(logsRef, {
          userId: demoUserId,
          routineStepId: stepId,
          status: "completed",
          completedAt: Timestamp.fromDate(logDate),
        });
      }
    }

    // 5. Add Demo Products to the Catalog
    const productsRef = collection(db, 'products');
    const demoProducts = [
      { name: "Salicylic Acid Cleanser", description: "Deep cleans pores.", suitabilityTags: ["oily", "acne"] },
      { name: "Hyaluronic Acid Serum", description: "Intense hydration.", suitabilityTags: ["dry", "aging"] },
      { name: "Centella Soothing Cream", description: "Calms redness.", suitabilityTags: ["sensitive", "dry"] },
    ];

    for (const product of demoProducts) {
      await addDoc(productsRef, {
        ...product,
        updatedAt: Timestamp.now()
      });
    }

    console.log("✅ Demonstration data successfully seeded!");
    alert("Demo Data Added! Refresh your charts to see it.");

  } catch (error) {
    console.error("Error seeding data:", error);
    alert("Failed to seed data. Check console.");
  }
};