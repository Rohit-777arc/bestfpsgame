import * as THREE from "three";
import type { MapDef } from "@/game/sim/maps";

function groundTexture(map: MapDef): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = map.groundBase;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const s = Math.random() * map.groundFleck - map.groundFleck / 2;
    g.fillStyle = s >= 0 ? `rgba(255,255,255,${Math.min(0.25, s / 80)})` : `rgba(0,0,0,${Math.min(0.25, -s / 80)})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(20, 20);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function crateTexture(map: MapDef): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = map.crateColor;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = map.crateAccent;
  g.lineWidth = 10;
  g.strokeRect(5, 5, 118, 118);
  g.beginPath();
  g.moveTo(5, 5);
  g.lineTo(123, 123);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export { groundTexture, crateTexture };

/** Seeded masonry and aged timber: stable surfaces without texture shimmer. */
export function dungeonTexture(kind: 'stone' | 'floor' | 'wood'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  let seed = kind === 'wood' ? 57 : 163;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  context.fillStyle = kind === 'wood' ? '#55422e' : '#696b63';
  context.fillRect(0, 0, 256, 256);
  const rows = kind === 'floor' ? 4 : 8;
  for (let row = 0; row < rows; row++) {
    for (let col = -1; col < 5; col++) {
      const x = col * 64 + (kind === 'stone' && row % 2 ? 32 : 0);
      const y = row * 256 / rows;
      const value = Math.floor(130 + random() * 45);
      context.fillStyle = kind === 'wood' ? `rgb(${value - 30},${value - 55},${value - 83})` : `rgb(${value + 8},${value + 6},${value - 5})`;
      context.fillRect(x + 1.5, y + 1.5, 61, 256 / rows - 3);
      context.strokeStyle = '#ffffff18';
      context.strokeRect(x + 3, y + 3, 58, 256 / rows - 6);
    }
  }
  for (let i = 0; i < 1200; i++) {
    context.fillStyle = random() > .5 ? '#ffffff12' : '#1b21171a';
    context.fillRect(random() * 256, random() * 256, 1 + random() * 4, kind === 'wood' ? 1 : 1 + random() * 4);
  }
  for (let i = 0; i < 10; i++) {
    context.strokeStyle = '#252b2040';
    context.lineWidth = .7;
    const x = random() * 256; const y = random() * 256;
    context.beginPath(); context.moveTo(x, y); context.lineTo(x + 8, y + 12); context.lineTo(x + 4, y + 20); context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'wood' ? 1 : 8, kind === 'stone' ? 2 : kind === 'floor' ? 8 : 1);
  texture.anisotropy = 4;
  return texture;
}
