"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onReminderCreated = void 0;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-functions/v2/firestore");
admin.initializeApp();
exports.onReminderCreated = (0, firestore_1.onDocumentCreated)("reminder/{reminderId}", async (event) => {
    var _a, _b, _c, _d, _e;
    const reminder = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!reminder)
        return;
    const clientID = (_b = reminder.clientID) !== null && _b !== void 0 ? _b : "";
    const uid = clientID.replace("/clients/", "");
    if (!uid)
        return;
    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const pushToken = (_c = userSnap.data()) === null || _c === void 0 ? void 0 : _c.pushToken;
    if (!pushToken)
        return;
    await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            to: pushToken,
            title: (_d = reminder.templateTitle) !== null && _d !== void 0 ? _d : "New Reminder",
            body: (_e = reminder.message) !== null && _e !== void 0 ? _e : "Your consultant sent you a reminder.",
            sound: "default",
            data: { type: "reminder" },
        }),
    });
});
//# sourceMappingURL=index.js.map