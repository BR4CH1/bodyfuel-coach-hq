/**
 * Player Card Layout — Positionen & Größen aller Overlay-Elemente.
 *
 * Wird vom Layout-Editor (siehe /coach/player-cards/layout) gepflegt und in
 * localStorage persistiert. `PlayerCard` liest daraus und rendert entsprechend.
 */

export type LayoutItem = { x: number; y: number; fontSize?: number };
export type PhotoItem = { x: number; y: number; w: number; h: number; url: string | null };

export type PlayerCardLayout = {
  ovr: LayoutItem;
  pos: LayoutItem;
  jersey: LayoutItem;
  age: LayoutItem;
  height: LayoutItem;
  weight: LayoutItem;
  spd: LayoutItem;
  acc: LayoutItem;
  agi: LayoutItem;
  pow: LayoutItem;
  str: LayoutItem;
  end: LayoutItem;
  updateDate: LayoutItem;
  strongest: LayoutItem;
  photo: PhotoItem;
};

export const DEFAULT_LAYOUT: PlayerCardLayout = {
  ovr: { x: 175, y: 255, fontSize: 150 },
  pos: { x: 175, y: 440, fontSize: 96 },
  jersey: { x: 175, y: 580, fontSize: 56 },
  age: { x: 255, y: 775, fontSize: 32 },
  height: { x: 255, y: 850, fontSize: 32 },
  weight: { x: 255, y: 925, fontSize: 32 },
  spd: { x: 160, y: 1275, fontSize: 72 },
  acc: { x: 305, y: 1275, fontSize: 72 },
  agi: { x: 450, y: 1275, fontSize: 72 },
  pow: { x: 595, y: 1275, fontSize: 72 },
  str: { x: 740, y: 1275, fontSize: 72 },
  end: { x: 885, y: 1275, fontSize: 72 },
  updateDate: { x: 490, y: 1420, fontSize: 26 },
  strongest: { x: 820, y: 1420, fontSize: 26 },
  photo: { x: 320, y: 260, w: 500, h: 620, url: null },
};

const KEY = "bfr:player-card-layout:v1";

export function loadLayout(): PlayerCardLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LAYOUT, ...parsed, photo: { ...DEFAULT_LAYOUT.photo, ...(parsed.photo ?? {}) } };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: PlayerCardLayout) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(layout));
}

export function resetLayout() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export const VB_W = 1023;
export const VB_H = 1537;
