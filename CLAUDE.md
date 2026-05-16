# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npx expo start              # Start dev server (scan QR for mobile)
npx expo start --web        # Start web-only dev server
npx expo start --ios        # iOS simulator
npx expo start --android    # Android emulator

# Build
npx expo export -p web      # Build for web (output to /dist)

# Lint
npx expo lint
```

There are no automated tests in this project.

## Architecture Overview

This is a **React Native / Expo Router** skincare management app with two distinct user experiences on a single codebase:

- **Mobile app** (`/(tabs)/`): Client-facing, bottom-tab navigation. Accessed by patients/users.
- **Web admin portal** (`/(admin)/`): Drawer navigation, web-only. Accessed by skincare professionals.

Platform routing is enforced at `app/index.tsx` and each layout file using `Platform.OS === 'web'` checks. Admins on mobile and clients on web are redirected to `/` or shown an access-denied fallback.

### Navigation & Routing

Expo Router file-based routing with three route groups:
- `(auth)` — login and registration
- `(tabs)` — client app (mobile only)
- `(admin)` — admin portal (web only)

`app/_layout.tsx` is a root Stack with no headers. Role checks happen inside `(tabs)/_layout.tsx` and `(admin)/_layout.tsx` by reading `users/{uid}.role` from Firestore.

### Data Layer

**Firebase/Firestore** is the sole backend — no REST API. All screens subscribe to real-time updates via `onSnapshot()` listeners, cleaned up on component unmount.

Key Firestore collections:
| Collection | Purpose |
|---|---|
| `users` | Auth profiles with `role` field (`'admin'` or user) |
| `clients` | Client stats: `streak`, `totalCompleted` |
| `routines` | Routines assigned to clients (`clientId`, `type: 'Morning'|'Night'`, `steps[]`) |
| `routineLogs` | Completion records (`clientId`, `routineID`, `logDate`, `mood`, `notes`) |
| `reminder` | Admin-sent reminders (`clientID` as `/clients/{uid}` path, `status: 'unread'|'read'`) |
| `skinLogs` | Skin metric entries (`hydration`, `oiliness`, `sensitivity`, `brightness`) |
| `products` | Product catalog filtered by `skinType` and `skinConcern` |

Firebase auth uses platform-specific persistence: `getReactNativePersistence(AsyncStorage)` on native, standard `getAuth()` on web. Config is in `src/lib/firebase.ts`.

### State Management

No Redux or Context API. Each screen manages its own state with `useState` + Firestore `onSnapshot` listeners. The `src/features/` and `src/services/` directories contain helper functions for Firestore queries.

### Design Tokens

Centralized in `src/constants/theme.ts`: primary pink (`#FF8BA7`), background (`#F7F9FC`), spacing scale, and font sizes. Use these rather than inline values.

### Business Logic Notes

- **Routine time windows**: Morning routines are only loggable 5am–12pm; Night routines 6pm–3am.
- **Duplicate prevention**: `routineLogs` checks for same `routineID` + `logDate` before writing.
- **Streak tracking**: Incremented in `clients/{uid}` on each successful routine log.
- **Reminder badge**: Unread count from `reminder` collection drives the tab badge in `(tabs)/_layout.tsx`.
- **Gemini API**: Key is stored as `EXPO_PUBLIC_GEMINI_API_KEY` in `.env.local`; integration lives in screen components that call Gemini for skin analysis.

### `src/` Directory

The `src/` directory was recently moved from `app/src/` and contains shared code:
- `src/lib/firebase.ts` — Firebase initialization
- `src/constants/theme.ts` — Design tokens
- `src/types/index.ts` — Firestore data model TypeScript types
- `src/services/` and `src/features/` — Firestore query helpers
