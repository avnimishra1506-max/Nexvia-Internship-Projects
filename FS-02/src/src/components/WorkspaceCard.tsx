"use client";

/**
 * src/components/WorkspaceCard.tsx
 * ───────────────────────────────────────────────────────────
 * Card shown on the dashboard for each workspace.
 * Works with both real DB data and demo data.
 * ───────────────────────────────────────────────────────────
 */

import Link from "next/link";

interface WorkspaceCardProps {
  workspace: {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
    documentCount: number;
    updatedAt: string;
    color: string;   // Tailwind gradient e.g. "from-purple-500 to-indigo-600"
    emoji: string;
  };
}

export default function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const timeAgo = formatTimeAgo(workspace.updatedAt);

  return (
    <Link href={`/workspace?id=${workspace.id}`} className="group block">
      <div className="relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all duration-200 cursor-pointer overflow-hidden min-h-[160px] flex flex-col justify-between">
        {/* Gradient accent bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${workspace.color} opacity-70 group-hover:opacity-100 transition-opacity`}
        />

        {/* Top section */}
        <div>
          {/* Emoji + name row */}
          <div className="flex items-start gap-3 mb-2">
            <span className="text-2xl leading-none flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
              {workspace.emoji}
            </span>
            <h3 className="text-sm font-semibold text-white leading-tight group-hover:text-purple-300 transition-colors">
              {workspace.name}
            </h3>
          </div>

          {workspace.description && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {workspace.description}
            </p>
          )}
        </div>

        {/* Bottom stats */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {workspace.documentCount}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {workspace.memberCount}
            </span>
          </div>
          <span className="text-xs text-slate-600">{timeAgo}</span>
        </div>
      </div>
    </Link>
  );
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
