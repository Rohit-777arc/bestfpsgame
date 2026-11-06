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
