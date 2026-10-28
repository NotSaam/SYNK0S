"use client";

import type { RemoteCursor } from "@/lib/useBoard";
import type { PresenceUser } from "@/shared/protocol";

export function Cursors({ cursors, presence }: { cursors: Record<string, RemoteCursor>; presence: PresenceUser[] }) {
  return (
    <>
      {Object.entries(cursors).map(([sid, c]) => {
        const user = presence.find((p) => p.sid === sid);
        if (!user) return null;
        return (
          <div
            key={sid}
            className="pointer-events-none absolute left-0 top-0 z-30 transition-transform duration-75 ease-linear"
            style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
            aria-hidden="true"
          >
            <svg width="16" height="18" viewBox="0 0 16 18" className="drop-shadow">
              <path d="M1 1l5.5 15 2.2-6.3L15 7.5z" fill={user.color} stroke="#0E0F12" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            <span
              className="ml-3 -mt-1 inline-block whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-void"
              style={{ background: user.color }}
            >
              {user.name}
            </span>
          </div>
        );
      })}
    </>
  );
}
