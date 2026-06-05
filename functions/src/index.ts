import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { Resend } from "resend";

admin.initializeApp();

const resendApiKey = defineSecret("RESEND_API_KEY");

export const onReminderCreated = onDocumentCreated(
  { document: "reminder/{reminderId}", secrets: [resendApiKey] },
  async (event) => {
    const reminder = event.data?.data();
    if (!reminder) return;

    const clientID: string = reminder.clientID ?? "";
    const uid = clientID.replace("/clients/", "");
    if (!uid) return;

    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const userData = userSnap.data();
    const email: string | undefined = userData?.email;
    const pushToken: string | undefined = userData?.pushToken;

    // Send push notification via Expo Push API
    if (pushToken) {
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

    // Send email via Resend
    if (email) {
      const resend = new Resend(resendApiKey.value());
      await resend.emails.send({
        from: "PrestigeMY <noreply@prestigemy.com>",
        to: email,
        subject: reminder.templateTitle ?? "New Reminder from Your Skincare Consultant",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #FF8BA7;">Hi there 👋</h2>
            <p>Your skincare consultant sent you a reminder:</p>
            <blockquote style="border-left: 4px solid #FF8BA7; padding-left: 16px; color: #555;">
              ${reminder.message ?? ""}
            </blockquote>
            <p>Open the <strong>PrestigeMY</strong> app to view your routine.</p>
          </div>
        `,
      });
    }
  }
);
