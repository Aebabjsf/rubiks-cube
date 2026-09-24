import * as THREE from 'three';

export const boxArgs: [number, number, number] = [0.985, 0.985, 0.985];

export const stickerGeometry = (() => {
  const size = 0.90;
  const radius = 0.15;
  const s = new THREE.Shape();
  const x = -size/2, y = -size/2, w = size, h = size;
  s.moveTo(x + radius, y);
  s.lineTo(x + w - radius, y);
  s.quadraticCurveTo(x + w, y, x + w, y + radius);
  s.lineTo(x + w, y + h - radius);
  s.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  s.lineTo(x + radius, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ShapeGeometry(s);
})();

export const materials = {
  base: new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.6, metalness: 0.1 }),
  R: new THREE.MeshStandardMaterial({ color: "#D12A2A", roughness: 0.2, metalness: 0.1 }),
  L: new THREE.MeshStandardMaterial({ color: "#E86B0C", roughness: 0.2, metalness: 0.1 }),
  U: new THREE.MeshStandardMaterial({ color: "#EEEEEE", roughness: 0.2, metalness: 0.1 }),
  D: new THREE.MeshStandardMaterial({ color: "#F2D11F", roughness: 0.2, metalness: 0.1 }),
  F: new THREE.MeshStandardMaterial({ color: "#1B5FE3", roughness: 0.2, metalness: 0.1 }),
  B: new THREE.MeshStandardMaterial({ color: "#199B35", roughness: 0.2, metalness: 0.1 }),
  X: new THREE.MeshStandardMaterial({ color: "#555555", roughness: 0.5, metalness: 0.0 }), // Grey for inactive
};

