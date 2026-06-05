import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();

export const onReminderCreated = onDocumentCreated(
  "reminder/{reminderId}",
  async (event) => {
    const reminder = event.data?.data();
    if (!reminder) return;

    const clientID: string = reminder.clientID ?? "";
    const uid = clientID.replace("/clients/", "");
    if (!uid) return;

    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const pushToken: string | undefined = userSnap.data()?.pushToken;

    if (!pushToken) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: pushToken,
        title: reminder.templateTitle ?? "New Reminder",
        body: reminder.message ?? "Your consultant sent you a reminder.",
        sound: "default",
        data: { type: "reminder" },
      }),
    });
  }
);
