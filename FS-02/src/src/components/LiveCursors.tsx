"use client";

import React, { useEffect, useState } from "react";
import { CollaboratorPresence } from "@/types";
import { DEFAULT_COLLABORATORS } from "@/lib/demo-data";

interface LiveCursorsProps {
  containerRef?: React.RefObject<HTMLDivElement>;
  enabled?: boolean;
}

export const LiveCursors: React.FC<LiveCursorsProps> = ({ enabled = true }) => {
  const [remoteCursors, setRemoteCursors] = useState<CollaboratorPresence[]>([
    {
      clientId: 101,
      user: DEFAULT_COLLABORATORS[0],
      cursor: { x: 380, y: 320 },
      lastActive: Date.now(),
    },
    {
      clientId: 102,
      user: DEFAULT_COLLABORATORS[1],
      cursor: { x: 620, y: 440 },
      lastActive: Date.now(),
    },
  ]);

  // Simulated live presence movement showing cursor gliding
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setRemoteCursors((prev) =>
        prev.map((c) => {
          const deltaX = (Math.random() - 0.5) * 80;
          const deltaY = (Math.random() - 0.5) * 50;

          const currentX = c.cursor?.x || 400;
          const currentY = c.cursor?.y || 300;

          const newX = Math.max(120, Math.min(800, currentX + deltaX));
          const newY = Math.max(180, Math.min(700, currentY + deltaY));

          return {
            ...c,
            cursor: { x: newX, y: newY },
            lastActive: Date.now(),
          };
        })
      );
    }, 2400);

    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {remoteCursors.map((presence) => {
        if (!presence.cursor) return null;
        const color = presence.user.cursorColor || presence.user.color || "#6366f1";

        return (
          <div
            key={presence.clientId}
            className="absolute transition-all duration-300 ease-out"
            style={{
              transform: `translate3d(${presence.cursor.x}px, ${presence.cursor.y}px, 0)`,
            }}
          >
            {/* Figma-style pointer cursor */}
            <svg
              className="w-5 h-5 drop-shadow-md"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                fill={color}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            </svg>

            {/* Name badge */}
            <div
              className="ml-3 -mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold text-white shadow-sm whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80 animate-ping" />
              <span>{presence.user.name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

