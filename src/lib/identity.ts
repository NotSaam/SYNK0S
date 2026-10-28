"use client";

import { COLORS } from "@/shared/protocol";

export interface Identity {
  name: string;
  color: (typeof COLORS)[number];
}

const KEY = "synk0s:identity";
const RECENT = "synk0s:recent";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado o almacenamiento bloqueado: seguimos sin persistir */
  }
}

export function loadIdentity(): Identity | null {
  const id = read<Identity>(KEY);
  if (!id || typeof id.name !== "string" || !COLORS.includes(id.color)) return null;
  return id;
}

export function saveIdentity(id: Identity) {
  write(KEY, id);
}

export interface RecentBoard {
  id: string;
  name: string;
  visitedAt: number;
}

export function loadRecent(): RecentBoard[] {
  const list = read<RecentBoard[]>(RECENT);
  return Array.isArray(list) ? list.slice(0, 8) : [];
}

export function rememberBoard(board: { id: string; name: string }) {
  const list = loadRecent().filter((b) => b.id !== board.id);
  list.unshift({ ...board, visitedAt: Date.now() });
  write(RECENT, list.slice(0, 8));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
