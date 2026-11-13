import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { stickerGeometry } from '../utils/cubeStyles';
import { playCubeClick } from '../utils/audio';
import { useAuthStore } from '../store/authStore';
import { RotateCcw, Sparkles } from 'lucide-react';

export interface DuelCubie {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  initX: number;
  initY: number;
  initZ: number;
}

// Scratch объекты для оптимизации GC в Three.js
const _scratchBasePos = new THREE.Vector3();
const _scratchBaseQuat = new THREE.Quaternion();
const _scratchAxisVec = new THREE.Vector3();
const _scratchQ = new THREE.Quaternion();
const _dragNormal = new THREE.Vector3();
const _dragPlane = new THREE.Plane();
const _raycaster = new THREE.Raycaster();
const _targetPoint = new THREE.Vector3();

// Размер пластикового бокса 0.96 (как в 3D симуляции), отступ наклейки 0.486
const CUBIE_BOX_ARGS: [number, number, number] = [0.96, 0.96, 0.96];
const STICKER_OFFSET = 0.486;

// Единая общая геометрия кубика для максимального FPS и устранения нагрузки на GPU
const sharedCubieGeometry = new THREE.BoxGeometry(0.96, 0.96, 0.96);

// Пул материалов с включенным polygonOffset для абсолютного устранения мерцания (Z-fighting)
const materialPool = new Map<string, THREE.MeshStandardMaterial>();

function getPooledMaterial(colorHex: string) {
  let mat = materialPool.get(colorHex);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.2,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -2.0,
    });
    materialPool.set(colorHex, mat);
  }
  return mat;
}

const basePlasticMaterial = new THREE.MeshStandardMaterial({
  color: '#080808',
  roughness: 0.6,
  metalness: 0.1,
});

export function createInitialCubies(): DuelCubie[] {
  const cubies: DuelCubie[] = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        cubies.push({
          id: `${x}-${y}-${z}`,
          position: new THREE.Vector3(x, y, z),
          rotation: new THREE.Euler(0, 0, 0),
          initX: x,
          initY: y,
          initZ: z,
        });
      }
    }
  }
  return cubies;
}

export function parseMove(moveStr: string) {
  const axisMap: Record<string, 'x' | 'y' | 'z'> = { R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' };
  const valMap: Record<string, number> = { U: 1, D: -1, R: 1, L: -1, F: 1, B: -1 };
  const base = moveStr[0];
  const axis = axisMap[base] || 'y';
  const val = valMap[base] ?? 1;
  const isPrime = moveStr.includes("'");
  const isDouble = moveStr.includes('2');

  let dir: 1 | -1 = 1;
  if (base === 'U' || base === 'R' || base === 'F') {
    dir = isPrime ? 1 : -1;
  } else {
    dir = isPrime ? -1 : 1;
  }
  return { axis, val, dir, isDouble };
}

export function applyRotationSync(
  cubies: DuelCubie[],
  axis: 'x' | 'y' | 'z',
  value: number,
  direction: 1 | -1,
  isDouble: boolean = false
): DuelCubie[] {
  const angle = (Math.PI / 2) * direction * (isDouble ? 2 : 1);
  const quaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0),
    angle
  );

  return cubies.map(cubie => {
    if (Math.round(cubie.position[axis]) === value) {
      const newPos = cubie.position.clone().applyQuaternion(quaternion);
      const currentQuat = new THREE.Quaternion().setFromEuler(cubie.rotation);
      const newQuat = quaternion.clone().multiply(currentQuat);
      const newEuler = new THREE.Euler().setFromQuaternion(newQuat);
      newPos.x = Math.round(newPos.x);
      newPos.y = Math.round(newPos.y);
      newPos.z = Math.round(newPos.z);
      return { ...cubie, position: newPos, rotation: newEuler };
    }
    return cubie;
  });
}

export function scrambleCubies(scramble: string): DuelCubie[] {
  let result = createInitialCubies();
  if (!scramble) return result;

  const moves = scramble
    .trim()
    .split(/\s+/)
    .filter(m => m.length > 0 && ['U', 'D', 'R', 'L', 'F', 'B'].includes(m[0]));

  for (const m of moves) {
    const parsed = parseMove(m);
    result = applyRotationSync(result, parsed.axis, parsed.val, parsed.dir, parsed.isDouble);
  }
  return result;
}

/**
 * Возвращает обратный WCA ход (например: R -> R', R' -> R, R2 -> R2)
 */
export function getInverseMove(moveStr: string): string {
  if (!moveStr) return '';
  const base = moveStr[0];
  if (moveStr.includes('2')) return `${base}2`;
  if (moveStr.includes("'")) return base;
  return `${base}'`;
}

/**
 * Генерирует последовательность ходов для пошаговой сборки кубика из текущего скрамбла
 */
export function getSolvingMoves(scrambleStr: string): string[] {
  if (!scrambleStr) return [];
  const moves = scrambleStr
    .trim()
    .split(/\s+/)
    .filter(m => m.length > 0 && ['U', 'D', 'R', 'L', 'F', 'B'].includes(m[0]));
  
  return moves.slice().reverse().map(getInverseMove);
}

/**
 * Надежная двойная проверка собранности кубика:
 * 1. Геометрическая: все 26 деталей вернулись на свои начальные позиции и ориентации.
 * 2. Визуальная: на каждой из 6 граней все 9 наклеек имеют строго одинаковый цвет (даже если весь кубик перевернут).
 */
export function checkIsSolved(cubies: DuelCubie[]): boolean {
  if (!cubies || cubies.length < 26) return false;

  // 1. Проверка по исходным позициям и кватернионам
  const idQuat = new THREE.Quaternion();
  const testQuat = new THREE.Quaternion();
  let allOriginMatch = true;

  for (const c of cubies) {
    if (
      Math.abs(c.position.x - c.initX) > 0.05 ||
      Math.abs(c.position.y - c.initY) > 0.05 ||
      Math.abs(c.position.z - c.initZ) > 0.05
    ) {
      allOriginMatch = false;
      break;
    }
    testQuat.setFromEuler(c.rotation);
    if (Math.abs(testQuat.angleTo(idQuat)) > 0.05) {
      allOriginMatch = false;
      break;
    }
  }

  if (allOriginMatch) return true;

  // 2. Проверка однородности цвета на всех 6 гранях
  const faceDirections: { axis: 'x' | 'y' | 'z'; val: number }[] = [
    { axis: 'y', val: 1 },  // Верхняя грань (U)
    { axis: 'y', val: -1 }, // Нижняя грань (D)
    { axis: 'x', val: 1 },  // Правая грань (R)
    { axis: 'x', val: -1 }, // Левая грань (L)
    { axis: 'z', val: 1 },  // Передняя грань (F)
    { axis: 'z', val: -1 }, // Задняя грань (B)
  ];

  const normalMap: Record<string, THREE.Vector3> = {
    R: new THREE.Vector3(1, 0, 0),
    L: new THREE.Vector3(-1, 0, 0),
    U: new THREE.Vector3(0, 1, 0),
    D: new THREE.Vector3(0, -1, 0),
    F: new THREE.Vector3(0, 0, 1),
    B: new THREE.Vector3(0, 0, -1),
  };

  const currentNormal = new THREE.Vector3();

  for (const face of faceDirections) {
    const faceCubies = cubies.filter(c => Math.round(c.position[face.axis]) === face.val);
    if (faceCubies.length !== 9) return false;

    let targetFaceColor: string | null = null;

    for (const cubie of faceCubies) {
      const stickersOnCubie: string[] = [];
      if (cubie.initX === 1) stickersOnCubie.push('R');
      if (cubie.initX === -1) stickersOnCubie.push('L');
      if (cubie.initY === 1) stickersOnCubie.push('U');
      if (cubie.initY === -1) stickersOnCubie.push('D');
      if (cubie.initZ === 1) stickersOnCubie.push('F');
      if (cubie.initZ === -1) stickersOnCubie.push('B');

      let stickerFacingDir: string | null = null;
      for (const st of stickersOnCubie) {
        currentNormal.copy(normalMap[st]).applyEuler(cubie.rotation);
        if (
          (face.axis === 'x' && Math.round(currentNormal.x) === face.val) ||
          (face.axis === 'y' && Math.round(currentNormal.y) === face.val) ||
          (face.axis === 'z' && Math.round(currentNormal.z) === face.val)
        ) {
          stickerFacingDir = st;
          break;
        }
      }

      if (!stickerFacingDir) return false;

      if (targetFaceColor === null) {
        targetFaceColor = stickerFacingDir;
      } else if (targetFaceColor !== stickerFacingDir) {
        return false;
      }
    }
  }

  return true;
}

// Отдельная деталь кубика (читает синхронный cubiesRef для полного устранения 1-кадрового мерцания)
interface CubieItemProps {
  cubieId: string;
  cubiesRef: React.MutableRefObject<DuelCubie[]>;
  activeAnimRef: React.MutableRefObject<{
    axis: 'x' | 'y' | 'z' | null;
    val: number | null;
    angle: number;
  }>;
  palette: Record<string, string>;
  onStickerPointerDown?: (cubie: DuelCubie, face: string, point: THREE.Vector3) => void;
  isInteractive: boolean;
}

function CubieItem({
  cubieId,
  cubiesRef,
  activeAnimRef,
  palette,
  onStickerPointerDown,
  isInteractive,
}: CubieItemProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cubie = cubiesRef.current.find(c => c.id === cubieId)!;

  useFrame(() => {
    if (!groupRef.current) return;
    const latestCubie = cubiesRef.current.find(c => c.id === cubieId) || cubie;
    const { axis, val, angle } = activeAnimRef.current;

    _scratchBasePos.copy(latestCubie.position);
    _scratchBaseQuat.setFromEuler(latestCubie.rotation);

    if (axis !== null && val !== null && Math.round(latestCubie.position[axis]) === val) {
      _scratchAxisVec.set(0, 0, 0);
      _scratchAxisVec[axis] = 1;
      _scratchQ.setFromAxisAngle(_scratchAxisVec, angle);
      _scratchBasePos.applyQuaternion(_scratchQ);
      _scratchBaseQuat.premultiply(_scratchQ);
    }

    groupRef.current.position.copy(_scratchBasePos);
    groupRef.current.quaternion.copy(_scratchBaseQuat);
  });

  const getMat = (face: string) => getPooledMaterial(palette[face] || '#ffffff');

  const handlePointerDown = (face: string, e: any) => {
    if (!isInteractive || !onStickerPointerDown) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    const latestCubie = cubiesRef.current.find(c => c.id === cubieId) || cubie;
    onStickerPointerDown(latestCubie, face, e.point);
  };

  return (
    <group ref={groupRef}>
      <mesh geometry={sharedCubieGeometry} material={basePlasticMaterial} />

      {cubie.initX === 1 && (
        <group position={[STICKER_OFFSET, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh
            geometry={stickerGeometry}
            material={getMat('R')}
            onPointerDown={e => handlePointerDown('R', e)}
          />
        </group>
      )}

      {cubie.initX === -1 && (
        <group position={[-STICKER_OFFSET, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh
            geometry={stickerGeometry}
            material={getMat('L')}
            onPointerDown={e => handlePointerDown('L', e)}
          />
        </group>
      )}

      {cubie.initY === 1 && (
        <group position={[0, STICKER_OFFSET, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh
            geometry={stickerGeometry}
            material={getMat('U')}
            onPointerDown={e => handlePointerDown('U', e)}
          />
        </group>
      )}

      {cubie.initY === -1 && (
        <group position={[0, -STICKER_OFFSET, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh
            geometry={stickerGeometry}
            material={getMat('D')}
            onPointerDown={e => handlePointerDown('D', e)}
          />
        </group>
      )}

      {cubie.initZ === 1 && (
        <group position={[0, 0, STICKER_OFFSET]} rotation={[0, 0, 0]}>
          <mesh
            geometry={stickerGeometry}
            material={getMat('F')}
            onPointerDown={e => handlePointerDown('F', e)}
          />
        </group>
      )}

      {cubie.initZ === -1 && (
        <group position={[0, 0, -STICKER_OFFSET]} rotation={[0, Math.PI, 0]}>
          <mesh
            geometry={stickerGeometry}
            material={getMat('B')}
            onPointerDown={e => handlePointerDown('B', e)}
          />
        </group>
      )}
    </group>
  );
}

// 3D сцена кубика с прямым соответствием направления жестов мыши
interface CubeSceneProps {
  cubiesRef: React.MutableRefObject<DuelCubie[]>;
  isInteractive: boolean;
  isMatchRunning: boolean;
  onMove?: (newCount: number) => void;
  onSolved?: () => void;
  palette: Record<string, string>;
  orbitRef: React.RefObject<any>;
  animRef: React.MutableRefObject<{
    isAnimating: boolean;
    axis: 'x' | 'y' | 'z';
    val: number;
    dir: 1 | -1;
    isDouble: boolean;
    angle: number;
    targetAngle: number;
  }>;
  dragRef: React.MutableRefObject<{
    isDragging: boolean;
    startPoint: THREE.Vector3 | null;
    dragCubiePos: THREE.Vector3 | null;
    dragFaceAxis: 'x' | 'y' | 'z' | null;
    dragFaceSign: 1 | -1;
    axis: 'x' | 'y' | 'z' | null;
    val: number | null;
    angle: number;
  }>;
  moveCountRef: React.MutableRefObject<number>;
  autoRotate?: boolean;
  triggerRender: () => void;
}

function CubeScene({
  cubiesRef,
  isInteractive,
  isMatchRunning,
  onMove,
  onSolved,
  palette,
  orbitRef,
  animRef,
  dragRef,
  moveCountRef,
  autoRotate = false,
  triggerRender,
}: CubeSceneProps) {
  const { camera, pointer } = useThree();
  const rootGroupRef = useRef<THREE.Group>(null);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const targetPoint = useMemo(() => new THREE.Vector3(), []);
  const dragNormal = useMemo(() => new THREE.Vector3(), []);
  const dragPlane = useMemo(() => new THREE.Plane(), []);

  // Реф активной анимации (изменяется напрямую в useFrame без вызова setState)
  const activeAnimRef = useRef<{
    axis: 'x' | 'y' | 'z' | null;
    val: number | null;
    angle: number;
  }>({ axis: null, val: null, angle: 0 });

  // Клик по наклейке для начала перетаскивания (Drag & Drop)
  const handleStickerPointerDown = useCallback(
    (cubie: DuelCubie, face: string, point: THREE.Vector3) => {
      if (!isInteractive) return;
      if (animRef.current.isAnimating || dragRef.current.isDragging) return;

      // Блокируем камеру на время перетаскивания
      if (orbitRef.current) {
        orbitRef.current.enabled = false;
      }

      // Вычисляем мировую нормаль нажатой грани с учетом текущего поворота кубика
      const localNormal = new THREE.Vector3();
      if (face === 'R') localNormal.set(1, 0, 0);
      else if (face === 'L') localNormal.set(-1, 0, 0);
      else if (face === 'U') localNormal.set(0, 1, 0);
      else if (face === 'D') localNormal.set(0, -1, 0);
      else if (face === 'F') localNormal.set(0, 0, 1);
      else if (face === 'B') localNormal.set(0, 0, -1);

      const worldNormal = localNormal.applyEuler(cubie.rotation).normalize();

      let dragFaceAxis: 'x' | 'y' | 'z' = 'x';
      if (Math.abs(worldNormal.x) > 0.5) dragFaceAxis = 'x';
      else if (Math.abs(worldNormal.y) > 0.5) dragFaceAxis = 'y';
      else if (Math.abs(worldNormal.z) > 0.5) dragFaceAxis = 'z';

      const dragFaceSign: 1 | -1 = worldNormal[dragFaceAxis] > 0 ? 1 : -1;

      dragRef.current = {
        isDragging: true,
        startPoint: point.clone(),
        dragCubiePos: cubie.position.clone(),
        dragFaceAxis,
        dragFaceSign,
        axis: null,
        val: null,
        angle: 0,
      };
    },
    [isInteractive, orbitRef, animRef, dragRef]
  );

  useFrame((_, delta) => {
    // Автоповорот для кубика соперника до старта матча
    if (autoRotate && rootGroupRef.current) {
      rootGroupRef.current.rotation.y += delta * 0.35;
    }

    // Обработка перетаскивания грани (Drag & Drop)
    const drag = dragRef.current;
    if (drag.isDragging && drag.dragFaceAxis && drag.startPoint && drag.dragCubiePos) {
      raycaster.setFromCamera(pointer, camera);
      dragNormal.set(0, 0, 0);
      dragNormal[drag.dragFaceAxis] = drag.dragFaceSign;
      dragPlane.setFromNormalAndCoplanarPoint(dragNormal, drag.startPoint);

      if (raycaster.ray.intersectPlane(dragPlane, targetPoint)) {
        const deltaVec = targetPoint.clone().sub(drag.startPoint);

        if (!drag.axis) {
          if (deltaVec.length() > 0.12) {
            let axis: 'x' | 'y' | 'z' = 'y';
            if (drag.dragFaceAxis === 'z') {
              axis = Math.abs(deltaVec.x) > Math.abs(deltaVec.y) ? 'y' : 'x';
            } else if (drag.dragFaceAxis === 'x') {
              axis = Math.abs(deltaVec.z) > Math.abs(deltaVec.y) ? 'y' : 'z';
            } else if (drag.dragFaceAxis === 'y') {
              axis = Math.abs(deltaVec.x) > Math.abs(deltaVec.z) ? 'z' : 'x';
            }

            // В соревновательном кубике Рубика крутятся только внешние слои (+1 или -1).
            // При нажатии на центральную деталь определяем слой по стороне касания относительно центра
            let val = Math.round(drag.dragCubiePos[axis]);
            if (val === 0) {
              val = drag.startPoint[axis] > 0 ? 1 : -1;
            }

            drag.axis = axis;
            drag.val = val;
          }
        }

        if (drag.axis && drag.val !== null) {
          const rotateVector = new THREE.Vector3(
            drag.axis === 'x' ? 1 : 0,
            drag.axis === 'y' ? 1 : 0,
            drag.axis === 'z' ? 1 : 0
          );
          const expectedDelta = rotateVector.clone().cross(drag.startPoint).normalize();
          const dragDist = deltaVec.dot(expectedDelta);
          const angle = Math.max(-Math.PI / 1.5, Math.min(Math.PI / 1.5, dragDist * 0.9));

          drag.angle = angle;
          activeAnimRef.current = { axis: drag.axis, val: drag.val, angle };
        }
      }
    }

    // Обработка анимации докрутки грани
    const anim = animRef.current;
    if (anim.isAnimating) {
      const turnSpeed = anim.isDouble ? 34.0 : 26.0; // Быстрый соревновательный темп (~65мс)
      const step = turnSpeed * delta * anim.dir;
      let nextAngle = anim.angle + step;
      let finished = false;

      if ((anim.dir > 0 && nextAngle >= anim.targetAngle) || (anim.dir < 0 && nextAngle <= anim.targetAngle)) {
        nextAngle = anim.targetAngle;
        finished = true;
      }
      anim.angle = nextAngle;

      if (finished) {
        anim.isAnimating = false;
        activeAnimRef.current = { axis: null, val: null, angle: 0 };

        // Если это была реальная докрутка до 90 градусов (а не пружинный возврат к 0)
        if (anim.targetAngle !== 0) {
          const updated = applyRotationSync(cubiesRef.current, anim.axis, anim.val, anim.dir, anim.isDouble);
          cubiesRef.current = updated;
          playCubeClick();

          const newMoves = moveCountRef.current + 1;
          moveCountRef.current = newMoves;

          if (onMove) {
            onMove(newMoves);
          }

          // Автоматическая фиксация победы сайтом
          if (isMatchRunning && checkIsSolved(updated)) {
            if (onSolved) {
              onSolved();
            }
          }
        }

        triggerRender();
      } else {
        activeAnimRef.current = { axis: anim.axis, val: anim.val, angle: nextAngle };
      }
    } else if (activeAnimRef.current.axis !== null && !dragRef.current.isDragging) {
      activeAnimRef.current = { axis: null, val: null, angle: 0 };
    }
  });

  const initialCubies = useMemo(() => createInitialCubies(), []);

  return (
    <group ref={rootGroupRef}>
      {initialCubies.map(c => (
        <CubieItem
          key={c.id}
          cubieId={c.id}
          cubiesRef={cubiesRef}
          activeAnimRef={activeAnimRef}
          palette={palette}
          onStickerPointerDown={handleStickerPointerDown}
          isInteractive={isInteractive}
        />
      ))}
    </group>
  );
}

export interface DuelCubeCanvasProps {
  scramble: string;
  isInteractive?: boolean;
  isMatchRunning?: boolean;
  onMove?: (newMoveCount: number) => void;
  onSolved?: () => void;
  opponentMoveTrigger?: number;
  opponentNextMove?: string | null;
  opponentTurn?: { move: string; step: number } | null;
  isOpponentFinished?: boolean;
  accentColor?: 'brand' | 'amber';
  playerName?: string;
  className?: string;
}

export const DuelCubeCanvas = React.memo(function DuelCubeCanvas({
  scramble,
  isInteractive = true,
  isMatchRunning = false,
  onMove,
  onSolved,
  opponentMoveTrigger = 0,
  opponentNextMove = null,
  opponentTurn = null,
  isOpponentFinished = false,
  accentColor = 'brand',
  playerName,
  className = '',
}: DuelCubeCanvasProps) {
  const user = useAuthStore(state => state.user);
  const customColors = user?.settings?.custom_colors;

  const palette: Record<string, string> = useMemo(
    () => ({
      U: customColors?.U || '#F2D11F', // Желтый
      D: customColors?.D || '#EEEEEE', // Белый
      R: customColors?.R || '#D12A2A', // Красный
      L: customColors?.L || '#E86B0C', // Оранжевый
      F: customColors?.F || '#199B35', // Зеленый
      B: customColors?.B || '#1B5FE3', // Синий
    }),
    [customColors]
  );

  const cubiesRef = useRef<DuelCubie[]>(scrambleCubies(scramble));
  const [, setTick] = useState(0);
  const triggerRender = useCallback(() => setTick(t => t + 1), []);

  const orbitRef = useRef<any>(null);
  const moveCountRef = useRef(0);

  const animRef = useRef({
    isAnimating: false,
    axis: 'x' as 'x' | 'y' | 'z',
    val: 0,
    dir: 1 as 1 | -1,
    isDouble: false,
    angle: 0,
    targetAngle: 0,
  });

  const dragRef = useRef<{
    isDragging: boolean;
    startPoint: THREE.Vector3 | null;
    dragCubiePos: THREE.Vector3 | null;
    dragFaceAxis: 'x' | 'y' | 'z' | null;
    dragFaceSign: 1 | -1;
    axis: 'x' | 'y' | 'z' | null;
    val: number | null;
    angle: number;
  }>({
    isDragging: false,
    startPoint: null,
    dragCubiePos: null,
    dragFaceAxis: null,
    dragFaceSign: 1,
    axis: null,
    val: null,
    angle: 0,
  });

  // При смене скрамбла или перезапуске инициализируем заново
  useEffect(() => {
    moveCountRef.current = 0;
    animRef.current.isAnimating = false;
    dragRef.current.isDragging = false;
    cubiesRef.current = scrambleCubies(scramble);
    triggerRender();
  }, [scramble, triggerRender]);

  // Запрос плавного вращения грани
  const requestRotate = useCallback(
    (axis: 'x' | 'y' | 'z', val: number, dir: 1 | -1, isDouble = false) => {
      if (dragRef.current.isDragging) return;
      if (animRef.current.isAnimating) {
        // Мгновенно применяем предыдущий незавершенный поворот (если это не пружинный возврат)
        const prev = animRef.current;
        if (prev.targetAngle !== 0) {
          cubiesRef.current = applyRotationSync(cubiesRef.current, prev.axis, prev.val, prev.dir, prev.isDouble);
          const newMoves = moveCountRef.current + 1;
          moveCountRef.current = newMoves;
          if (onMove) onMove(newMoves);
        }
      }
      const angleMultiplier = isDouble ? 2 : 1;
      animRef.current = {
        isAnimating: true,
        axis,
        val,
        dir,
        isDouble,
        angle: 0,
        targetAngle: (Math.PI / 2) * dir * angleMultiplier,
      };
    },
    [onMove]
  );

  // Завершение перетаскивания (Pointer Up)
  const handlePointerUp = useCallback(() => {
    if (orbitRef.current) {
      orbitRef.current.enabled = true;
    }

    const drag = dragRef.current;
    if (!drag.isDragging) return;

    const { axis, val, angle } = drag;
    dragRef.current = {
      isDragging: false,
      startPoint: null,
      dragCubiePos: null,
      dragFaceAxis: null,
      dragFaceSign: 1,
      axis: null,
      val: null,
      angle: 0,
    };

    if (axis && val !== null) {
      if (Math.abs(angle) > Math.PI / 8) {
        const dir: 1 | -1 = angle > 0 ? 1 : -1;
        animRef.current = {
          isAnimating: true,
          axis,
          val,
          dir,
          isDouble: false,
          angle,
          targetAngle: (Math.PI / 2) * dir,
        };
      } else {
        // Пружинный возврат, если угол слишком мал (возвращается к 0, ход не засчитывается)
        animRef.current = {
          isAnimating: true,
          axis,
          val,
          dir: (angle > 0 ? -1 : 1) as 1 | -1,
          isDouble: false,
          angle,
          targetAngle: 0,
        };
      }
    }
  }, []);

  // Глобальный слушатель отпускания мыши (даже если курсор вышел за пределы канваса)
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (dragRef.current.isDragging) {
        handlePointerUp();
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [handlePointerUp]);

  // Клавиатурные ходы (поддержка English и русской раскладки клавиатуры)
  useEffect(() => {
    if (!isInteractive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (animRef.current.isAnimating || dragRef.current.isDragging) return;

      const isShift = e.shiftKey;
      const code = e.code;
      const key = e.key.toUpperCase();

      // U: Up (Клавиша U / Г)
      if (code === 'KeyU' || key === 'U' || key === 'Г') {
        requestRotate('y', 1, isShift ? 1 : -1);
      }
      // D: Down (Клавиша D / В)
      else if (code === 'KeyD' || key === 'D' || key === 'В') {
        requestRotate('y', -1, isShift ? -1 : 1);
      }
      // R: Right (Клавиша R / К)
      else if (code === 'KeyR' || key === 'R' || key === 'К') {
        requestRotate('x', 1, isShift ? 1 : -1);
      }
      // L: Left (Клавиша L / Д)
      else if (code === 'KeyL' || key === 'L' || key === 'Д') {
        requestRotate('x', -1, isShift ? -1 : 1);
      }
      // F: Front (Клавиша F / А)
      else if (code === 'KeyF' || key === 'F' || key === 'А') {
        requestRotate('z', 1, isShift ? 1 : -1);
      }
      // B: Back (Клавиша B / И)
      else if (code === 'KeyB' || key === 'B' || key === 'И') {
        requestRotate('z', -1, isShift ? -1 : 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInteractive, requestRotate]);

  // Анимация ходов оппонента (выполняется точный WCA ход бота или соперника)
  useEffect(() => {
    if (isInteractive) return;
    const moveStr = opponentTurn?.move || opponentNextMove;
    if (!moveStr) return;
    const parsed = parseMove(moveStr);
    requestRotate(parsed.axis, parsed.val, parsed.dir, parsed.isDouble);
  }, [opponentTurn, opponentNextMove, isInteractive, requestRotate]);

  // Когда оппонент закончил, мгновенно приводим его кубик в собранный вид
  useEffect(() => {
    if (!isInteractive && isOpponentFinished) {
      animRef.current.isAnimating = false;
      cubiesRef.current = createInitialCubies();
      triggerRender();
    }
  }, [isOpponentFinished, isInteractive, triggerRender]);

  // Управление камерой (орбита)
  const resetCamera = () => {
    if (orbitRef.current) {
      orbitRef.current.reset();
    }
  };

  const rotateCameraStep = (direction: 1 | -1) => {
    if (orbitRef.current) {
      const angle = (Math.PI / 2) * direction;
      const cam = orbitRef.current.object;
      if (cam) {
        const x = cam.position.x;
        const z = cam.position.z;
        cam.position.x = x * Math.cos(angle) - z * Math.sin(angle);
        cam.position.z = x * Math.sin(angle) + z * Math.cos(angle);
        orbitRef.current.update();
      }
    }
  };

  const handleFaceMove = (face: 'U' | 'D' | 'R' | 'L' | 'F' | 'B', isPrime = false) => {
    switch (face) {
      case 'U':
        requestRotate('y', 1, isPrime ? 1 : -1);
        break;
      case 'D':
        requestRotate('y', -1, isPrime ? -1 : 1);
        break;
      case 'R':
        requestRotate('x', 1, isPrime ? 1 : -1);
        break;
      case 'L':
        requestRotate('x', -1, isPrime ? -1 : 1);
        break;
      case 'F':
        requestRotate('z', 1, isPrime ? 1 : -1);
        break;
      case 'B':
        requestRotate('z', -1, isPrime ? -1 : 1);
        break;
    }
  };

  const isCurrentSolved = checkIsSolved(cubiesRef.current);

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden bg-black/45 border ${
        accentColor === 'amber' ? 'border-amber-500/30' : 'border-brand-400/30'
      } shadow-2xl select-none flex flex-col ${className}`}
      onPointerUp={handlePointerUp}
      onContextMenu={e => e.preventDefault()}
    >
      {/* 3D Canvas */}
      <div className="w-full h-72 sm:h-80 md:h-88 relative cursor-grab active:cursor-grabbing">
        <Canvas
          camera={{ position: [5, 4, 6], fov: 42 }}
          dpr={[1, 1.25]}
          performance={{ min: 0.5 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false }}
        >
          <ambientLight intensity={1.5} />
          <directionalLight position={[10, 15, 10]} intensity={1.8} />
          <directionalLight position={[-10, -10, -10]} intensity={0.6} />

          <OrbitControls
            ref={orbitRef}
            enablePan={false}
            minDistance={4}
            maxDistance={11}
            mouseButtons={{
              LEFT: undefined,
              MIDDLE: THREE.MOUSE.ROTATE,
              RIGHT: THREE.MOUSE.ROTATE,
            } as any}
          />

          <CubeScene
            cubiesRef={cubiesRef}
            isInteractive={isInteractive}
            isMatchRunning={isMatchRunning}
            onMove={onMove}
            onSolved={onSolved}
            palette={palette}
            orbitRef={orbitRef}
            animRef={animRef}
            dragRef={dragRef}
            moveCountRef={moveCountRef}
            autoRotate={!isInteractive && !isMatchRunning}
            triggerRender={triggerRender}
          />
        </Canvas>

        {/* Бейдж завершения сборки */}
        {((!isInteractive && isOpponentFinished) || (isInteractive && isCurrentSolved && moveCountRef.current > 0)) && (
          <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-300 z-10">
            <div className="p-3.5 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-400 mb-2 shadow-xl shadow-emerald-500/40 animate-bounce">
              <Sparkles className="w-7 h-7 text-emerald-300" />
            </div>
            <span className="text-base font-black text-emerald-300 tracking-wider uppercase drop-shadow-lg">
              {isInteractive ? 'Кубик собран!' : 'Соперник собрал кубик!'}
            </span>
          </div>
        )}

        {/* Панель ракурса камеры */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
          <button
            onClick={() => rotateCameraStep(-1)}
            className="p-1.5 rounded-xl bg-black/80 hover:bg-black border border-white/10 text-white/80 hover:text-white transition-all text-xs cursor-pointer shadow-md"
            title="Повернуть камеру влево на 90°"
          >
            ↺
          </button>
          <button
            onClick={resetCamera}
            className="px-2.5 py-1.5 rounded-xl bg-black/80 hover:bg-black border border-white/10 text-[11px] text-white/80 hover:text-white transition-all flex items-center gap-1 cursor-pointer shadow-md"
            title="Сбросить угол камеры"
          >
            <RotateCcw className="w-3 h-3" />
            Центр
          </button>
          <button
            onClick={() => rotateCameraStep(1)}
            className="p-1.5 rounded-xl bg-black/80 hover:bg-black border border-white/10 text-white/80 hover:text-white transition-all text-xs cursor-pointer shadow-md"
            title="Повернуть камеру вправо на 90°"
          >
            ↻
          </button>
        </div>

        {/* Подсказка управления внизу Canvas */}
        {isInteractive && (
          <div className="absolute bottom-2.5 left-3 text-[10px] sm:text-xs text-white/70 bg-black/80 px-3 py-1 rounded-xl border border-white/10 pointer-events-none flex items-center gap-2 shadow-md">
            <span>🖱️ <b>ЛКМ</b> — тянуть грань</span>
            <span className="text-white/30">•</span>
            <span><b>ПКМ</b> — крутить камеру</span>
          </div>
        )}
      </div>

      {/* Сенсорные соревновательные кнопки быстрых ходов (U, D, R, L, F, B) */}
      {isInteractive && (
        <div className="p-3 bg-[#0e0a16] border-t border-brand-400/20 flex flex-col gap-2">
          {/* Ряд ходов по часовой стрелке */}
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            <span className="text-[11px] font-bold text-brand-300 w-14 shrink-0">Ходы:</span>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end">
              {(['U', 'D', 'R', 'L', 'F', 'B'] as const).map(face => (
                <button
                  key={face}
                  onClick={() => handleFaceMove(face, false)}
                  className="flex-1 py-1.5 rounded-xl bg-brand-500/20 hover:bg-brand-500/35 border border-brand-400/30 text-white font-mono font-bold text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer hover:border-brand-400 shadow-sm"
                  title={`Ход ${face} (Клавиша: ${face})`}
                >
                  {face}
                </button>
              ))}
            </div>
          </div>

          {/* Ряд обратных ходов (Prime / ') */}
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            <span className="text-[11px] font-bold text-amber-300 w-14 shrink-0">Обратные:</span>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end">
              {(['U', 'D', 'R', 'L', 'F', 'B'] as const).map(face => (
                <button
                  key={`${face}-prime`}
                  onClick={() => handleFaceMove(face, true)}
                  className="flex-1 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-200 font-mono font-bold text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer hover:border-amber-400 shadow-sm"
                  title={`Обратный ход ${face}' (Клавиша: Shift + ${face})`}
                >
                  {face}'
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
