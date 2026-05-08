# TaskMatrix — Week 17 (Production Deployment)

A project management tool (Jira/Asana-like) built with Next.js 14, Firebase Auth, Firestore, and Zustand — now deployed to production on Vercel.

## What's New in Week 17

### 🏗️ Phase 1 — Production Build Compilation
- Migrated from `npm run dev` to a passing `npm run build` (strict production compiler)
- Resolved all TypeScript errors blocking the build:
  - Fixed `next/font/google` network dependency by removing the Google Fonts import and falling back to the system font stack via Tailwind's `font-sans`
  - Fixed TypeScript `never` type inference on `displayedProjects` in the Projects board view by extracting the board card into a dedicated `ProjectBoardCard` component and pre-computing `activeProjectId` before the JSX return
  - Fixed `"use client"` directive placement conflict caused by inserting `export const dynamic` before it — directive must always be the first line
  - Fixed Firebase `auth/invalid-api-key` crash during Next.js static page generation by guarding `initializeApp()` with a `typeof window !== "undefined"` check in `src/lib/firebase.ts`, preventing SSR build-time crashes when environment variables are absent

### ☁️ Phase 2 — Cloud Deployment & Secrets Management
- Codebase pushed to GitHub and connected to **Vercel** for CI/CD
- All Firebase environment variables securely migrated from local `.env.local` into the **Vercel Environment Variables dashboard**
- Live production URL: `https://your-project.vercel.app` *(update with your actual URL)*
- Any `git push` to `main` automatically triggers a rebuild and redeploy

### 🔦 Phase 3 — Lighthouse Audit & Web Performance Optimization
- Ran Lighthouse audit on the live Vercel URL via Chrome DevTools
- Targeted 90+ scores in both **Performance** and **Accessibility**
- Optimizations applied:
  - Image compression and use of Next.js `<Image />` component for automatic WebP conversion and lazy loading
  - Resolved semantic HTML accessibility issues (alt attributes, heading order, ARIA labels)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth & DB | Firebase (Auth + Firestore) |
| State | Zustand |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| AI | Gemini API (sub-steps generation, priority suggestion) |
| Notifications | Sonner (toast notifications) |
| Language | TypeScript |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout with AuthProvider
│   ├── page.tsx                    # Redirects to /login
│   ├── globals.css
│   ├── login/
│   │   └── page.tsx                # Login form
│   ├── register/
│   │   └── page.tsx                # Registration form
│   ├── api/
│   │   └── ai/
│   │       ├── generate-substeps/  # AI sub-steps API route
│   │       └── suggest-priority/   # AI priority suggestion API route
│   └── dashboard/
│       ├── layout.tsx              # Dashboard layout (protected, with sidebar)
│       ├── page.tsx                # Main dashboard
│       ├── projects/page.tsx       # Projects board/list/timeline view
│       ├── tasks/page.tsx          # Tasks management
│       ├── activity/page.tsx       # Activity log
│       ├── team/page.tsx           # Team members
│       ├── settings/page.tsx       # User settings
│       └── ...                     # Other dashboard pages
├── components/
│   ├── AuthProvider.tsx            # Firebase onAuthStateChanged listener
│   └── layout/
│       ├── Sidebar.tsx             # Nav sidebar
│       └── TopBar.tsx              # Top header bar
├── lib/
│   ├── firebase.ts                 # Firebase app init (SSR-safe guarded init)
│   ├── tasks.ts                    # Firestore task helpers
│   ├── projects.ts                 # Firestore project helpers
│   └── activity.ts                 # Activity log helpers
├── store/
│   └── authStore.ts                # Zustand store (user UID, name, email)
└── middleware.ts                   # Route protection (redirect to /login if not authed)
```

---

## Local Development Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Enable **Authentication** → Email/Password provider
4. Enable **Firestore Database** (start in test mode for development)
5. Go to **Project Settings → Your Apps → Web App** and copy your config

### 3. Set environment variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Run a production build locally

```bash
npm run build
npm start
```

---

## Deployment (Vercel)

### First-time setup

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**
3. Import your GitHub repository — Vercel auto-detects Next.js
4. In the **Environment Variables** section, add all variables from your `.env.local`
5. Click **Deploy**

### Environment variables to add in Vercel dashboard

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firestore project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `GEMINI_API_KEY` | Gemini API key for AI features |

> **Important:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser bundle. `GEMINI_API_KEY` is server-only and never exposed to the client.

### CI/CD — Continuous Deployment

Every `git push` to the `main` branch automatically triggers a new Vercel build and overwrites the live deployment. To deploy a hotfix, simply push a new commit.

---

## Routes

| Route | Description |
|---|---|
| `/` | Redirects to `/login` |
| `/login` | Login form |
| `/register` | Sign-up form |
| `/dashboard` | Main dashboard |
| `/dashboard/projects` | Projects board/list/timeline |
| `/dashboard/tasks` | Task management |
| `/dashboard/activity` | Activity log |
| `/dashboard/team` | Team members |
| `/dashboard/settings` | User settings |

---

## Authentication Flow

1. **Register:** `createUserWithEmailAndPassword` → updates display name → saves profile to Firestore `users` collection
2. **Login:** `signInWithEmailAndPassword` → sets `auth-token` cookie → redirects to dashboard
3. **Session:** `AuthProvider` uses `onAuthStateChanged` to rehydrate Zustand store on page refresh
4. **Logout:** `signOut` → clears cookie → redirects to `/login`
5. **Middleware:** `src/middleware.ts` checks for `auth-token` cookie on every protected route request

---

## Milestones Completed

- [x] **Week 13** — Pages: `/login`, `/register`, `/dashboard` with working forms
- [x] **Week 14** — Firebase Auth connected (register + login + route protection)
- [x] **Week 15** — Full CRUD: Tasks and Projects with Firestore
- [x] **Week 16** — AI pipelines (sub-steps generation, priority suggestion), Sonner toasts, skeleton loaders
- [x] **Week 17** — Production build fixed, deployed to Vercel, Lighthouse audit completed