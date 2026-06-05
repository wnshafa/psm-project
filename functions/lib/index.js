"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onReminderCreated = void 0;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const resend_1 = require("resend");
admin.initializeApp();
const resendApiKey = (0, params_1.defineSecret)("RESEND_API_KEY");
exports.onReminderCreated = (0, firestore_1.onDocumentCreated)({ document: "reminder/{reminderId}", secrets: [resendApiKey] }, async (event) => {
    var _a, _b, _c, _d, _e, _f;
    const reminder = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!reminder)
        return;
    const clientID = (_b = reminder.clientID) !== null && _b !== void 0 ? _b : "";
    const uid = clientID.replace("/clients/", "");
    if (!uid)
        return;
    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const userData = userSnap.data();
    const email = userData === null || userData === void 0 ? void 0 : userData.email;
    const pushToken = userData === null || userData === void 0 ? void 0 : userData.pushToken;
    // Send push notification via Expo Push API
    if (pushToken) {
        await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                to: pushToken,
                title: (_c = reminder.templateTitle) !== null && _c !== void 0 ? _c : "New Reminder",
                body: (_d = reminder.message) !== null && _d !== void 0 ? _d : "Your consultant sent you a reminder.",
                sound: "default",
                data: { type: "reminder" },
            }),
        });
    }
    // Send email via Resend
    if (email) {
        const resend = new resend_1.Resend(resendApiKey.value());
        await resend.emails.send({
            from: "PrestigeMY <noreply@prestigemy.com>",
            to: email,
            subject: (_e = reminder.templateTitle) !== null && _e !== void 0 ? _e : "New Reminder from Your Skincare Consultant",
            html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #FF8BA7;">Hi there 👋</h2>
            <p>Your skincare consultant sent you a reminder:</p>
            <blockquote style="border-left: 4px solid #FF8BA7; padding-left: 16px; color: #555;">
              ${(_f = reminder.message) !== null && _f !== void 0 ? _f : ""}
            </blockquote>
            <p>Open the <strong>PrestigeMY</strong> app to view your routine.</p>
          </div>
        `,
        });
    }
});
//# sourceMappingURL=index.js.map