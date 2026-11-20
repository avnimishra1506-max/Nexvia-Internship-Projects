/**
 * src/lib/demo-data.ts
 * ───────────────────────────────────────────────────────────
 * Client-safe demo/placeholder data used by client components
 * when the database is offline (development only).
 *
 * ⚠️  No server-only imports here — this file is safe to import
 *     from both client and server components.
 * ───────────────────────────────────────────────────────────
 */

export const DEFAULT_USER = {
  id: "demo-user-001",
  name: "Alex Johnson",
  email: "alex@collabspace.io",
  avatar: null as string | null,
  color: "#6366f1",
  cursorColor: "#6366f1",
  createdAt: new Date("2024-01-15"),
};

export const DEFAULT_COLLABORATORS = [
  {
    id: "demo-collab-001",
    name: "Sarah Chen",
    email: "sarah@collabspace.io",
    avatar: null as string | null,
    color: "#10b981",
    cursorColor: "#10b981",
  },
  {
    id: "demo-collab-002",
    name: "Marcus Rivera",
    email: "marcus@collabspace.io",
    avatar: null as string | null,
    color: "#f59e0b",
    cursorColor: "#f59e0b",
  },
  {
    id: "demo-collab-003",
    name: "Priya Sharma",
    email: "priya@collabspace.io",
    avatar: null as string | null,
    color: "#ef4444",
    cursorColor: "#ef4444",
  },
];
