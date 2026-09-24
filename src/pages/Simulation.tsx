import { Pyraminx } from '../components/Pyraminx';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { ErrorBoundary } from '../ErrorBoundary';
import { OrbitControls } from '@react-three/drei';
import { useCubeStore } from '../store/cubeStore';
import type { Cubie } from '../store/cubeStore';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { boxArgs, stickerGeometry, materials } from '../utils/cubeStyles';

// Контроллер анимации: работает на каждом кадре (useFrame)
// Если в сторе флаг isAnimating = true, он вызывает updateAnimation,
// что плавно докручивает грань до 90 градусов.

  function AnimationController() {
  const isAnimating = useCubeStore(state => state.isAnimating);
  const updateAnimation = useCubeStore(state => state.updateAnimation);

  useFrame((_, delta) => {
    if (isAnimating) {
      const speed = 10.0; // Скорость вращения (радиан в секунду)
      updateAnimation(speed * delta);
    }
  });

  return null;
}

// Контроллер перетаскивания (Drag & Drop)
// Использует Raycaster для проецирования позиции мыши/пальца в 3D плоскость вращения
function DragController() {
  const isDragging = useCubeStore(state => state.isDragging);
  const dragFace = useCubeStore(state => state.dragFace);
  const dragSign = useCubeStore(state => state.dragSign);
  const startPoint = useCubeStore(state => state.startPoint);
  const updateDrag3D = useCubeStore(state => state.updateDrag3D);
  
  const { camera, pointer } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const targetPoint = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (isDragging && dragFace && startPoint) {
      // Бросаем луч от камеры к курсору
      raycaster.setFromCamera(pointer, camera);
      
      const normal = new THREE.Vector3();
      normal[dragFace] = dragSign || 1;
      
      // Создаем невидимую плоскость в месте клика
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, startPoint);
      if (raycaster.ray.intersectPlane(plane, targetPoint)) {
         // Передаем точку пересечения в стор для расчета угла
         updateDrag3D(targetPoint);
      }
    }
  });

  return null;
}



function FlatSticker({ material, onPointerDown, colorHex, scale }: { material: THREE.Material, onPointerDown: (e: any) => void, colorHex?: string, scale?: number[] }) {
    const scaleVec = scale ? new THREE.Vector3(scale[0], scale[1], scale[2]) : new THREE.Vector3(1,1,1);
    
    const customMat = useMemo(() => {
      if (!colorHex) return null;
      return new THREE.MeshStandardMaterial({ 
        color: colorHex, 
        roughness: colorHex === '#ffffff' ? 0.2 : 0.1, 
        metalness: colorHex === '#ffffff' ? 0.6 : 0.1 
      });
    }, [colorHex]);

    if (colorHex && customMat) {
      return <mesh onPointerDown={onPointerDown} geometry={stickerGeometry} material={customMat} scale={scaleVec} />;
    }
    return <mesh onPointerDown={onPointerDown} geometry={stickerGeometry} material={material} scale={scaleVec} />;
  }


// 2D развертка кубика для раскраски
  
    function CubeNet2D() {
    
    const paintColors = useCubeStore(state => state.paintColors);
    const paintSticker = useCubeStore(state => state.paintSticker);
    const puzzleType = useCubeStore(state => state.puzzleType);

    if (puzzleType === 'pyraminx') {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto p-4 animate-in fade-in zoom-in duration-300 relative z-10">
           <div className="text-white text-center text-lg bg-black/40 p-6 rounded-2xl border border-white/20 shadow-2xl">
              Для пирамидки 2D режим недоступен. Пожалуйста, раскрашивайте ее в 3D режиме!
           </div>
        </div>
      );
    }

    const faceToMirrorColor = (f: string) => (({ 'L': '#ffffff', 'D': '#ffff00', 'B': '#00ff00', 'F': '#0000ff', 'U': '#ff0000', 'R': '#ff8800' } as any)[f] || 'white');
  
    const renderFace = (face: any, gridX: any, gridY: any, rows: any[], cols: any[], xFn: any, yFn: any, zFn: any) => {
      const is2x2 = puzzleType === '2x2';
      return (
        <div key={face} className={`grid ${is2x2 ? 'grid-cols-2' : 'grid-cols-3'} gap-1 p-1 bg-white/10 rounded-lg`} style={{ gridColumn: gridX, gridRow: gridY }}>
          {rows.map((r: any) => cols.map((c: any) => {
            const x = xFn(r, c);
            const y = yFn(r, c);
            const z = zFn(r, c);
            const isCenter = Math.abs(x) + Math.abs(y) + Math.abs(z) === 1;
            const id = `${x}-${y}-${z}`;
            const color = isCenter ? face : (paintColors[`${id}-${face}`] || face);
            
            let bgClass = (({ U: 'bg-[#F2D11F]', R: 'bg-[#D12A2A]', F: 'bg-[#199B35]', D: 'bg-[#EEEEEE]', L: 'bg-[#E86B0C]', B: 'bg-[#1B5FE3]' }) as any)[color] || "bg-white/20";
            let customStyle = {};
            if (puzzleType === 'mirror') {
                customStyle = { backgroundColor: faceToMirrorColor(color) };
                bgClass = '';
            }

            return (
              <div 
                key={id} 
                className={`w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-sm cursor-pointer transition-transform hover:scale-110 active:scale-95 shadow-inner ${bgClass} ${isCenter && !is2x2 ? 'ring-2 ring-white/50 cursor-not-allowed' : ''}`}
                style={customStyle}
                onClick={() => (!isCenter || is2x2) && paintSticker(id, face)}
              />
            );
          }))}
        </div>
      );
    };

    const is2x2 = puzzleType === '2x2';
    const it = is2x2 ? [-1, 1] : [-1, 0, 1];

    return (
      <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto p-4 animate-in fade-in zoom-in duration-300 relative z-10">
        <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-md text-center">
          {puzzleType === 'mirror' ? 'Раскраска зеркального кубика (формы)' : 'Раскраска кубика'}
        </h2>
        {puzzleType === 'mirror' && (
          <div className="text-sm text-brand-50 mb-6 text-center bg-black/40 p-3 rounded-lg border border-brand-400/30">
            Для зеркального кубика цвета обозначают форму.
          </div>
        )}
        
        <div className="grid grid-cols-4 grid-rows-3 gap-2 mb-8 bg-black/20 p-4 sm:p-6 md:p-8 rounded-2xl backdrop-blur-sm border border-white/10 shadow-2xl scale-[0.8] sm:scale-90 md:scale-100 origin-center">
          {renderFace('U', 2, 1, it, it, (r: any, c: any) => c, (_r: any, _c: any) => 1, (r: any, c: any) => r)}
          {renderFace('L', 1, 2, it, it, (_r: any, _c: any) => -1, (r: any, c: any) => -r, (r: any, c: any) => c)}
          {renderFace('F', 2, 2, it, it, (r: any, c: any) => c, (r: any, c: any) => -r, (_r: any, _c: any) => 1)}
          {renderFace('R', 3, 2, it, it, (_r: any, _c: any) => 1, (r: any, c: any) => -r, (r: any, c: any) => -c)}
          {renderFace('B', 4, 2, it, it, (r: any, c: any) => -c, (r: any, c: any) => -r, (_r: any, _c: any) => -1)}
          {renderFace('D', 2, 3, it, it, (r: any, c: any) => c, (_r: any, _c: any) => -1, (r: any, c: any) => -r)}
        </div>
      </div>
    );
  }


function CubieMesh({ cubie }: { cubie: any }) {
    const isPaintMode = useCubeStore(state => state.isPaintMode);
        const paintColors = useCubeStore(state => state.paintColors);
    const puzzleType = useCubeStore(state => state.puzzleType);
    const paintSticker = useCubeStore(state => state.paintSticker);
    const isMirror = puzzleType === 'mirror';
    const is2x2 = puzzleType === '2x2';

    const groupRef = useRef<THREE.Group>(null);

    const initX = cubie.initialPosition.x;
    const initY = cubie.initialPosition.y;
    const initZ = cubie.initialPosition.z;
    const isCorner = Math.abs(initX) === 1 && Math.abs(initY) === 1 && Math.abs(initZ) === 1;

    const xOffsets: Record<string, number> = { '-1': 0.15, '0': 0, '1': 0.15 };
    const yOffsets: Record<string, number> = { '-1': 0.10, '0': 0, '1': 0.10 };
    const zOffsets: Record<string, number> = { '-1': 0.05, '0': 0, '1': 0.05 };

        const boxScale = isMirror ? [
      initX === 1 ? 1.3 : (initX === -1 ? 0.7 : 1.0),
      initY === 1 ? 1.2 : (initY === -1 ? 0.8 : 1.0),
      initZ === 1 ? 1.1 : (initZ === -1 ? 0.9 : 1.0)
    ] : [0.96, 0.96, 0.96];

    const getStickerScale = (face: string): [number, number, number] => {
      if (!isMirror) return is2x2 ? [2, 2, 2] : [1, 1, 1];
      if (face === 'R' || face === 'L') return [1, (boxScale[1] - 0.04)/0.86, (boxScale[2] - 0.04)/0.86];
      if (face === 'U' || face === 'D') return [(boxScale[0] - 0.04)/0.86, 1, (boxScale[2] - 0.04)/0.86];
      if (face === 'F' || face === 'B') return [(boxScale[0] - 0.04)/0.86, (boxScale[1] - 0.04)/0.86, 1];
      return [1, 1, 1];
    };

    const localOffset = useMemo(() => new THREE.Vector3(
      isMirror ? xOffsets[initX.toString()] : 0,
      isMirror ? yOffsets[initY.toString()] : 0,
      isMirror ? zOffsets[initZ.toString()] : 0
    ), [isMirror, initX, initY, initZ, xOffsets, yOffsets, zOffsets]);

    useFrame(() => {
      if (!groupRef.current) return;
      const state = useCubeStore.getState();
      const latestCubie = state.cubies.find(c => c.id === cubie.id) || cubie;
      const isActive = state.isAnimating || state.isDragging;
      const activeAxis = state.isAnimating ? state.animAxis : state.dragAxis;
      const activeValue = state.isAnimating ? state.animValue : state.dragValue;
      const angle = state.isAnimating ? state.animAngle : state.dragAngle;
      
      const basePos = latestCubie.position.clone();
      const baseQuat = new THREE.Quaternion().setFromEuler(latestCubie.rotation);
      
      if (isActive && activeAxis && latestCubie.position[activeAxis] === activeValue) {
        const axisVec = new THREE.Vector3();
        axisVec[activeAxis] = 1;
        const q = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);
        basePos.applyQuaternion(q);
        baseQuat.premultiply(q);
      }
      
      groupRef.current.position.copy(basePos).add(localOffset.clone().applyQuaternion(baseQuat));
      groupRef.current.quaternion.copy(baseQuat);
    });

    const mapPaintColor = (code: string) => {
      const map: Record<string, string> = {
        U: '#F2D11F', R: '#D12A2A', F: '#199B35',
        D: '#EEEEEE', L: '#E86B0C', B: '#1B5FE3'
      };
      return map[code];
    };

    const getColor = (face: any) => {
      if (isPaintMode && !isMirror) {
        const p = paintColors[`${cubie.id}-${face}`];
        if (p) return mapPaintColor(p);
      }
      if (isMirror) return "#cccccc";
      
      const originalColor = {
        U: '#F2D11F', D: '#EEEEEE', R: '#D12A2A', L: '#E86B0C', F: '#199B35', B: '#1B5FE3'
      }[face as string];
      
      return isPaintMode ? '#555555' : originalColor;
    };

    const handlePointerDown = (face: any, e: any) => {
      if (e.button !== 0) return;
      if (isPaintMode) {
        e.stopPropagation();
        paintSticker(cubie.id, face);
      } else {
        e.stopPropagation();
        const pt = e.point.clone();
        
        const localNormal = new THREE.Vector3();
        if (face === 'R') localNormal.set(1, 0, 0);
        else if (face === 'L') localNormal.set(-1, 0, 0);
        else if (face === 'U') localNormal.set(0, 1, 0);
        else if (face === 'D') localNormal.set(0, -1, 0);
        else if (face === 'F') localNormal.set(0, 0, 1);
        else if (face === 'B') localNormal.set(0, 0, -1);
        
        const worldNormal = localNormal.applyEuler(cubie.rotation).normalize();
        
        let dragAxis: 'x' | 'y' | 'z' = 'x';
        if (Math.abs(worldNormal.x) > 0.5) dragAxis = 'x';
        else if (Math.abs(worldNormal.y) > 0.5) dragAxis = 'y';
        else if (Math.abs(worldNormal.z) > 0.5) dragAxis = 'z';
        
        useCubeStore.getState().startDrag(dragAxis, 1, cubie.position, pt);
      }
    };

    if (is2x2 && !isCorner) return null;

    const actualBoxArgs = isMirror ? boxScale : (is2x2 ? [1.97, 1.97, 1.97] : boxArgs);
    
    const renderOffsetX = actualBoxArgs[0] / 2 + 0.005;
    const renderOffsetY = actualBoxArgs[1] / 2 + 0.005;
    const renderOffsetZ = actualBoxArgs[2] / 2 + 0.005;

    return (
      <group ref={groupRef}>
        {isMirror ? (
          <mesh>
            <boxGeometry args={actualBoxArgs as any} />
            <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.8} />
          </mesh>
        ) : (
          <RoundedBox args={actualBoxArgs as any} radius={0.05} smoothness={4} material={materials.base} />
        )}
        <group position={[renderOffsetX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          {initX === 1 && <FlatSticker colorHex={getColor('R')} material={materials.R} onPointerDown={(e) => handlePointerDown('R', e)} scale={getStickerScale('R')} />}
        </group>
        <group position={[-renderOffsetX, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          {initX === -1 && <FlatSticker colorHex={getColor('L')} material={materials.L} onPointerDown={(e) => handlePointerDown('L', e)} scale={getStickerScale('L')} />}
        </group>
        <group position={[0, renderOffsetY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          {initY === 1 && <FlatSticker colorHex={getColor('U')} material={materials.U} onPointerDown={(e) => handlePointerDown('U', e)} scale={getStickerScale('U')} />}
        </group>
        <group position={[0, -renderOffsetY, 0]} rotation={[Math.PI / 2, 0, 0]}>
          {initY === -1 && <FlatSticker colorHex={getColor('D')} material={materials.D} onPointerDown={(e) => handlePointerDown('D', e)} scale={getStickerScale('D')} />}
        </group>
        <group position={[0, 0, renderOffsetZ]}>
          {initZ === 1 && <FlatSticker colorHex={getColor('F')} material={materials.F} onPointerDown={(e) => handlePointerDown('F', e)} scale={getStickerScale('F')} />}
        </group>
        <group position={[0, 0, -renderOffsetZ]} rotation={[Math.PI, 0, 0]}>
          {initZ === -1 && <FlatSticker colorHex={getColor('B')} material={materials.B} onPointerDown={(e) => handlePointerDown('B', e)} scale={getStickerScale('B')} />}
        </group>
      </group>
    );
  }

export function Simulation() {
  const requestRotate = useCubeStore(state => state.requestRotate);
  const isDragging = useCubeStore(state => state.isDragging);
  const endDrag = useCubeStore(state => state.endDrag);
  const puzzleType = useCubeStore(state => state.puzzleType);
  const keyBindings = useCubeStore(state => state.keyBindings);
  const setKeyBinding = useCubeStore(state => state.setKeyBinding);
  
  const reset = useCubeStore(state => state.reset);
  const cubies = useCubeStore(state => state.cubies);
  const isPaintMode = useCubeStore(state => state.isPaintMode);
  const is2DPaintMode = useCubeStore(state => state.is2DPaintMode);
  const setIs2DPaintMode = useCubeStore(state => state.setIs2DPaintMode);

    const setPuzzleType = useCubeStore(state => state.setPuzzleType);
  const togglePaintMode = useCubeStore(state => state.togglePaintMode);
  const isAnimating = useCubeStore(state => state.isAnimating);
  const setActivePaintColor = useCubeStore(state => state.setActivePaintColor);
  const activePaintColor = useCubeStore(state => state.activePaintColor);
  const scramble = useCubeStore(state => state.scramble);
  const solveFormula = useCubeStore(state => state.solveFormula);
   // Mock if not in store
  const [showHint, setShowHint] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [listeningKey, setListeningKey] = useState<string | null>(null);
  const [isPyrSolved, setIsPyrSolved] = useState(false);
  const [pyrMoveCount, setPyrMoveCount] = useState(0);
  const [paintError, setPaintError] = useState<string | null>(null);

  useEffect(() => {
    const handlePyrUpdate = (e: any) => {
      setPyrMoveCount(e.detail.moveCount);
      setIsPyrSolved(e.detail.isSolved);
    };
    window.addEventListener('pyr-state-update', handlePyrUpdate);
    const handlePyrErr = (e: any) => setPaintError(e.detail.message);
    window.addEventListener('pyr-paint-error', handlePyrErr);
    return () => {
      window.removeEventListener('pyr-state-update', handlePyrUpdate);
      window.removeEventListener('pyr-paint-error', handlePyrErr);
    };
  }, []);


  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<any>(null);
    useEffect(() => {
      if (orbitRef.current) {
        orbitRef.current.mouseButtons = {
          LEFT: null, // Left click does nothing for camera
          MIDDLE: THREE.MOUSE.ROTATE, // Middle click rotates camera
          RIGHT: THREE.MOUSE.ROTATE  // Right click rotates camera
        };
      }
    }, []);


  // Хак для TrackballControls: перехватываем событие на этапе погружения (capture),
  // и если это клик колесиком (button=1), подменяем его на левый клик (button=0).
  // Это позволяет обойти жесткую привязку TrackballControls к левой кнопке.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    }, []);

  const resetCamera = () => {
    if (orbitRef.current) {
      orbitRef.current.reset();
    }
  };

  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Timer & Game State
  const moveCount = useCubeStore(state => state.moveCount);
  const solvePaintedCube = useCubeStore(state => state.solvePaintedCube);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isSolved, setIsSolved] = useState(false);

    // Check if solved
    useEffect(() => {
      let currentIsSolved = isSolved;
      if (puzzleType === 'pyraminx') {
        currentIsSolved = isPyrSolved;
      } else {
        let solved = true;
        const idQuat = new THREE.Quaternion();
        cubies.forEach(c => {
          if (c.position.distanceTo(c.initialPosition) > 0.01) solved = false;
          const currQuat = new THREE.Quaternion().setFromEuler(c.rotation);
          if (Math.abs(currQuat.angleTo(idQuat)) > 0.01) solved = false;
        });
        currentIsSolved = solved;
        if (solved !== isSolved) setIsSolved(solved);
      }

      const currentMoveCount = puzzleType === 'pyraminx' ? pyrMoveCount : moveCount;
      
      if (currentMoveCount === 0) {
        setStartTime(null);
        setCurrentTime(0);
        if (puzzleType !== 'pyraminx') setIsSolved(false);
        return;
      }
  
      if (currentMoveCount > 0 && !startTime && !currentIsSolved && solveFormula.length === 0) {
        setStartTime(Date.now());
      }
    }, [cubies, moveCount, pyrMoveCount, puzzleType, isPyrSolved, isSolved, startTime, solveFormula.length]);
  
    // Timer loop
    useEffect(() => {
      const currentIsSolved = puzzleType === 'pyraminx' ? isPyrSolved : isSolved;
      if (startTime && !currentIsSolved) {
        const interval = setInterval(() => {
          setCurrentTime(Date.now() - startTime);
        }, 10);
        return () => clearInterval(interval);
      }
    }, [startTime, isSolved, isPyrSolved, puzzleType]);

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor((ms % 1000) / 10);
    return `${mins > 0 ? mins + ':' : ''}${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleNativeMouseDown = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    const el = containerRef.current;
    if (el) {
      el.addEventListener('mousedown', handleNativeMouseDown);
      return () => el.removeEventListener('mousedown', handleNativeMouseDown);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Логика биндинга клавиш
      if (listeningKey) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        setKeyBinding(listeningKey as 'U'|'D'|'R'|'L'|'F'|'B', e.code);
        setListeningKey(null);
        return;
      }
      
      if (isAutoSolving || isLoading || isSolved || useCubeStore.getState().isPaintMode || useCubeStore.getState().puzzleType === 'pyraminx') return; 
      const isShift = e.shiftKey;
      
      switch(e.code) {
        case keyBindings.U: requestRotate('y', 1, isShift ? 1 : -1); break;
        case keyBindings.D: requestRotate('y', -1, isShift ? -1 : 1); break;
        case keyBindings.R: requestRotate('x', 1, isShift ? 1 : -1); break;
        case keyBindings.L: requestRotate('x', -1, isShift ? -1 : 1); break;
        case keyBindings.F: requestRotate('z', 1, isShift ? 1 : -1); break;
        case keyBindings.B: requestRotate('z', -1, isShift ? -1 : 1); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestRotate, isAutoSolving, isLoading, isSolved, keyBindings, listeningKey, setKeyBinding]);

  useEffect(() => {
    if (isAutoSolving) {
      if (solveFormula.length === 0) {
        setIsAutoSolving(false);
      } else if (!isAnimating) {
        const nextMove = solveFormula[0];
        const axisMap: Record<string, 'x'|'y'|'z'> = { R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' };
        const valMap: Record<string, number> = { U: 1, D: -1, R: 1, L: -1, F: 1, B: -1 };
        const base = nextMove[0];
        const isPrime = nextMove.includes("'");
        
        let dir: 1|-1 = 1;
        if (base === 'U' || base === 'R' || base === 'F') {
          dir = isPrime ? 1 : -1;
        } else {
          dir = isPrime ? -1 : 1;
        }
        
        setTimeout(() => {
          requestRotate(axisMap[base], valMap[base], dir);
        }, 150);
      }
    }
  }, [isAutoSolving, isAnimating, solveFormula, requestRotate]);

  const handlePointerUp = () => {
    if (isDragging) {
      endDrag();
    }
  };

  const moves = puzzleType === 'pyraminx' ? [
      { label: "U (Верх)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: 'U' })) },
      { label: "u (Уголок)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: 'u' })) },
      { label: "L (Лево)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: 'L' })) },
      { label: "l (Уголок)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: 'l' })) },
      { label: "R (Право)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: 'R' })) },
      { label: "r (Уголок)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: 'r' })) },
      { label: "B (Тыл)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: 'B' })) },
      { label: "b (Уголок)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: 'b' })) }
    ] : [
      { label: `${keyBindings.U.replace('Key', '')} (Верх)`, action: () => requestRotate('y', 1, -1) },
      { label: `${keyBindings.D.replace('Key', '')} (Низ)`, action: () => requestRotate('y', -1, 1) },
      { label: `${keyBindings.R.replace('Key', '')} (Право)`, action: () => requestRotate('x', 1, -1) },
      { label: `${keyBindings.L.replace('Key', '')} (Лево)`, action: () => requestRotate('x', -1, 1) },
      { label: `${keyBindings.F.replace('Key', '')} (Фронт)`, action: () => requestRotate('z', 1, -1) },
      { label: `${keyBindings.B.replace('Key', '')} (Тыл)`, action: () => requestRotate('z', -1, 1) },
    ];

    const reverseMoves = puzzleType === 'pyraminx' ? [
      { label: "U' (Верх обр.)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: "U'" })) },
      { label: "u' (Уголок обр.)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: "u'" })) },
      { label: "L' (Лево обр.)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: "L'" })) },
      { label: "l' (Уголок обр.)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: "l'" })) },
      { label: "R' (Право обр.)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: "R'" })) },
      { label: "r' (Уголок обр.)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: "r'" })) },
      { label: "B' (Тыл обр.)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: "B'" })) },
      { label: "b' (Уголок обр.)", action: () => window.dispatchEvent(new CustomEvent('pyr-move', { detail: "b'" })) }
    ] : [
      { label: `${keyBindings.U.replace('Key', '')}' (Верх обр.)`, action: () => requestRotate('y', 1, 1) },
      { label: `${keyBindings.D.replace('Key', '')}' (Низ обр.)`, action: () => requestRotate('y', -1, -1) },
      { label: `${keyBindings.R.replace('Key', '')}' (Право обр.)`, action: () => requestRotate('x', 1, 1) },
      { label: `${keyBindings.L.replace('Key', '')}' (Лево обр.)`, action: () => requestRotate('x', -1, -1) },
      { label: `${keyBindings.F.replace('Key', '')}' (Фронт обр.)`, action: () => requestRotate('z', 1, 1) },
      { label: `${keyBindings.B.replace('Key', '')}' (Тыл обр.)`, action: () => requestRotate('z', -1, -1) },
    ];
  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] p-4 lg:p-6 gap-6 max-w-[1600px] mx-auto w-full">
      <div 
        ref={containerRef}
        className="flex-grow relative rounded-3xl overflow-hidden bg-brand-900/5 dark:bg-brand-50/5 border border-brand-400/20 shadow-inner flex items-center justify-center min-h-[50vh] touch-none"
        onContextMenu={(e) => e.preventDefault()}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Neon Success Overlay */}
        <div className={`absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-700 ${(puzzleType === 'pyraminx' ? isPyrSolved : isSolved) && (puzzleType === 'pyraminx' ? pyrMoveCount : moveCount) > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className={`flex flex-col items-center transform transition-all duration-700 delay-300 ${isSolved || isPyrSolved ? 'translate-y-0 scale-100' : 'translate-y-10 scale-90'}`}>
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(34,197,94,0.4)]">
              <i className="fa-solid fa-check text-5xl text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]"></i>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-green-400 mb-2 drop-shadow-lg">
              КУБИК СОБРАН!
            </h2>
            <div className="flex gap-8 mt-8 bg-white/10 p-6 rounded-2xl border border-white/20">
              <div className="text-center">
                <p className="text-white/60 text-sm uppercase tracking-widest font-bold mb-1">Время</p>
                <p className="text-3xl font-mono font-bold text-white shadow-green-500/50 drop-shadow-md">{formatTime(currentTime)}</p>
              </div>
              <div className="w-px bg-white/20"></div>
              <div className="text-center">
                <p className="text-white/60 text-sm uppercase tracking-widest font-bold mb-1">Ходов</p>
                <p className="text-3xl font-mono font-bold text-white shadow-green-500/50 drop-shadow-md">{moveCount}</p>
              </div>
            </div>
            <button 
              onClick={() => { if (puzzleType === 'pyraminx') window.dispatchEvent(new CustomEvent('pyr-reset')); else reset(); setIsAutoSolving(false); }}
              className="mt-10 px-8 py-4 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all hover:scale-105 active:scale-95"
            >
              Еще раз
            </button>
          </div>
        </div>

        <div 
          className={`absolute inset-0 bg-brand-50 dark:bg-brand-900 z-20 flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <div className="relative w-20 h-20 perspective-1000">
            <div className="w-full h-full border-4 border-brand-400/50 rounded-2xl animate-[spin_3s_linear_infinite] shadow-[0_0_25px_rgba(191,126,184,0.3)]"></div>
            <div className="absolute inset-0 m-auto w-10 h-10 bg-brand-400/80 rounded-lg animate-[spin_2s_linear_infinite_reverse]"></div>
          </div>
            <span className="mt-6 font-bold text-brand-500 dark:text-brand-400 animate-pulse tracking-[0.3em] text-sm">СИМУЛЯЦИЯ 3D</span>
        </div>

        {/* HUD: Timer and Move Count */}
        <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-10 flex gap-4 transition-all duration-1000 ${isLoading ? '-translate-y-20 opacity-0' : 'translate-y-0 opacity-100'}`}>
          <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md px-6 py-2 rounded-2xl shadow-lg border border-brand-400/30 flex flex-col items-center min-w-[120px]">
            <span className="text-[10px] uppercase tracking-widest font-bold text-brand-500 dark:text-brand-400">Время</span>
            <span className={`text-2xl font-mono font-black ${startTime && !isSolved ? 'text-brand-900 dark:text-brand-50' : 'text-brand-900/50 dark:text-brand-50/50'}`}>
              {formatTime(currentTime)}
            </span>
          </div>
          <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md px-6 py-2 rounded-2xl shadow-lg border border-brand-400/30 flex flex-col items-center min-w-[90px]">
            <span className="text-[10px] uppercase tracking-widest font-bold text-brand-500 dark:text-brand-400">Ходы</span>
            <span className="text-2xl font-mono font-black text-brand-900 dark:text-brand-50">{moveCount}</span>
          </div>
        </div>

        <div className={`absolute inset-0 transition-opacity duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
          <Canvas camera={{ position: [5, 4, 6], fov: 45, zoom: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.8 : 1 }}>
            <ambientLight intensity={0.9} />
            <directionalLight position={[10, 15, 10]} intensity={1.5} />
            <directionalLight position={[-10, -10, -10]} intensity={0.8} />
            <AnimationController />
            <DragController />
            {puzzleType === 'pyraminx' ? <ErrorBoundary><Pyraminx /></ErrorBoundary> : ( <group> {cubies.map(cubie => ( <CubieMesh key={cubie.id} cubie={cubie} /> ))} </group> )}
            
          

            <OrbitControls 
                ref={orbitRef}
                enablePan={false} 
                enableZoom={true}
                enableDamping={true}
                dampingFactor={0.15}
                minDistance={4} 
                maxDistance={15} 
                mouseButtons={{
                  LEFT: 2, // Map to PAN, which is disabled via enablePan=false
                  MIDDLE: 0, // ROTATE
                  RIGHT: 0  // ROTATE
                }}
                enabled={!isDragging && !isLoading && !(puzzleType === 'pyraminx' ? (isPyrSolved && pyrMoveCount > 0) : (isSolved && moveCount > 0))}
              />
          </Canvas>

{/* Paint Error Modal */}
          <div className={`absolute inset-0 z-50 flex items-center justify-center transition-all duration-300 ${paintError ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPaintError(null)}></div>
            <div className={`bg-brand-900/90 border-2 border-[#D12A2A]/50 p-6 rounded-3xl shadow-[0_0_50px_rgba(209,42,42,0.3)] max-w-sm w-full mx-4 relative transform transition-all duration-300 ${paintError ? 'scale-100 translate-y-0' : 'scale-90 translate-y-8'}`}>
              <div className="w-16 h-16 bg-[#D12A2A]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#D12A2A]/50">
                 <i className="fa-solid fa-triangle-exclamation text-3xl text-[#D12A2A]"></i>
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-2">Ошибка сборки</h3>
              <p className="text-brand-50 text-center text-sm mb-6 leading-relaxed">
                {paintError}
              </p>
              <button 
                onClick={() => setPaintError(null)}
                className="w-full bg-gradient-to-r from-[#D12A2A] to-[#E86B0C] text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg"
              >
                Понятно
              </button>
            </div>
          </div>

        </div>
        
        {isPaintMode && is2DPaintMode && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-brand-900/40 backdrop-blur-md">
            <CubeNet2D />
          </div>
        )}
        
        <div className={`absolute bottom-6 right-6 flex flex-col gap-3 z-10 transition-opacity duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
          <button
            onClick={resetCamera}
            className="w-12 h-12 bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-full shadow-lg border border-brand-400/30 flex items-center justify-center hover:scale-105 transition-all text-brand-900 dark:text-brand-50 tooltip-trigger"
            title="Сбросить камеру"
          >
            <i className="fa-solid fa-camera"></i>
          </button>
        </div>
        
        
        {showHint && !isSolved && !isPaintMode ? (
          <div className={`absolute bottom-6 left-6 z-10 text-brand-900 dark:text-brand-50 bg-white/70 dark:bg-black/70 px-5 py-3 rounded-2xl backdrop-blur-md text-sm font-medium shadow-lg border border-brand-400/20 leading-relaxed max-w-sm pointer-events-auto transition-opacity duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            <button 
              onClick={() => setShowHint(false)} 
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
              <i className="fa-solid fa-circle-info text-brand-400"></i>
              <span className="font-bold text-white/90">
                Управление {
                  puzzleType === 'pyraminx' ? 'Пирамидкой' :
                  puzzleType === 'mirror' ? 'Mirror блоком' :
                  puzzleType === '2x2' ? 'кубиком 2x2' :
                  'кубиком 3x3'
                }
              </span>
            </div>
            <p className="pr-4 mb-1"><i className="fa-solid fa-cube text-brand-400 mr-2"></i><b>Зажать колесико (или ЛКМ по фону):</b> свободное вращение камеры во все стороны</p>
            <p className="mb-1"><i className="fa-regular fa-hand-pointer text-brand-400 mr-2"></i><b>ЛКМ по наклейке:</b> потяните чтобы вращать грань</p>
            {puzzleType === 'pyraminx' ? (
              <p className="mt-2 text-xs opacity-80 border-t border-brand-500/30 pt-2">
                <i className="fa-regular fa-hand-pointer mr-1"></i> Клавиатура отключена, используйте свайпы
              </p>
            ) : (
              <p className="mt-2 text-xs opacity-80 border-t border-brand-500/30 pt-2">
                <i className="fa-regular fa-keyboard mr-1"></i> Клавиши: {keyBindings.U.replace('Key','')} (В), {keyBindings.D.replace('Key','')} (Н), {keyBindings.R.replace('Key','')} (П), {keyBindings.L.replace('Key','')} (Л), {keyBindings.F.replace('Key','')} (Ф), {keyBindings.B.replace('Key','')} (З)
              </p>
            )}
          </div>
        ) : (
          !isSolved && !isPaintMode && (
            <div className={`absolute bottom-6 left-6 z-10 flex flex-col gap-3 transition-all duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
              {puzzleType !== 'pyraminx' && (
              <button 
                onClick={() => setShowSettings(true)}
                className="w-10 h-10 bg-white/70 dark:bg-black/70 backdrop-blur-md rounded-full shadow-lg border border-brand-400/20 flex items-center justify-center hover:scale-105 transition-all text-brand-900 dark:text-brand-50"
                title="��������� ����������"
              >
                <i className="fa-solid fa-gear"></i>
              </button>
            )}
              <button 
                onClick={() => setShowHint(true)}
                className="w-10 h-10 bg-white/70 dark:bg-black/70 backdrop-blur-md rounded-full shadow-lg border border-brand-400/20 flex items-center justify-center hover:scale-105 transition-all text-brand-900 dark:text-brand-50"
              >
                <i className="fa-solid fa-question"></i>
              </button>
            </div>
          )
        )}
      </div>

      {/* Модальное окно настроек */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-brand-900 border border-brand-400/30 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-brand-50"><i className="fa-solid fa-keyboard mr-2 text-brand-400"></i>Управление</h2>
              <button onClick={() => { setShowSettings(false); setListeningKey(null); }} className="text-white/50 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <p className="text-white/70 text-sm mb-6">Кликните на кнопку и нажмите клавишу на клавиатуре, чтобы переназначить поворот грани.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              {(['U', 'D', 'R', 'L', 'F', 'B'] as const).map(face => (
                <div key={face} className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-brand-400">
                      Грань {face} ({
                        face === 'U' ? 'Верх' : 
                        face === 'D' ? 'Низ' : 
                        face === 'R' ? 'Право' : 
                        face === 'L' ? 'Лево' : 
                        face === 'F' ? 'Фронт' : 
                        'Тыл'
                      })
                    </label>
                  <button
                    onClick={() => setListeningKey(face)}
                    className={`py-2 px-3 rounded-lg border font-mono text-sm transition-all ${listeningKey === face ? 'bg-brand-400 text-brand-900 border-brand-400 animate-pulse' : 'bg-black/40 text-brand-50 border-white/20 hover:border-brand-400/50'}`}
                  >
                    {listeningKey === face ? 'Нажмите клавишу...' : keyBindings[face].replace('Key', '')}
                  </button>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => useCubeStore.getState().resetKeyBindings()}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              Сбросить по умолчанию
            </button>
          </div>
        </div>
      )}
      
      <div className={`w-full lg:w-96 bg-brand-800 text-brand-50 rounded-3xl p-6 flex flex-col gap-6 overflow-y-auto shrink-0 shadow-2xl relative transition-transform duration-700 ease-out ${isLoading ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}>
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,transparent,rgba(0,0,0,0.2))] rounded-3xl pointer-events-none"></div>
        <h2 className="text-2xl font-bold relative flex items-center">
          <i className={`fa-solid ${isPaintMode ? 'fa-palette' : 'fa-gamepad'} mr-3 text-brand-400`}></i>
          {isPaintMode ? 'Раскраска' : 'Управление'}
        </h2>
<div className="relative flex bg-black/30 rounded-lg p-1 w-full text-xs font-bold shadow-inner mb-4">
  <button onClick={() => { setPuzzleType('3x3'); if(useCubeStore.getState().isPaintMode) togglePaintMode(); }} className={`flex-1 py-2 rounded-md transition-all ${puzzleType === '3x3' ? 'bg-brand-400 text-brand-900 shadow-md' : 'text-white/50 hover:text-white'}`}>3x3</button>
  <button onClick={() => { setPuzzleType('2x2'); if(useCubeStore.getState().isPaintMode) togglePaintMode(); }} className={`flex-1 py-2 rounded-md transition-all ${puzzleType === '2x2' ? 'bg-brand-400 text-brand-900 shadow-md' : 'text-white/50 hover:text-white'}`}>2x2</button>
  <button onClick={() => { setPuzzleType('mirror'); if(useCubeStore.getState().isPaintMode) togglePaintMode(); }} className={`flex-1 py-2 rounded-md transition-all ${puzzleType === 'mirror' ? 'bg-brand-400 text-brand-900 shadow-md' : 'text-white/50 hover:text-white'}`}>Mirror</button>
  <button onClick={() => { setPuzzleType('pyraminx'); if(useCubeStore.getState().isPaintMode) togglePaintMode(); }} className={`flex-1 py-2 rounded-md transition-all ${puzzleType === 'pyraminx' ? 'bg-brand-400 text-brand-900 shadow-md' : 'text-white/50 hover:text-white'}`}>Pyraminx</button>
</div>

        {!isPaintMode ? (
          <>
            <div className="relative">
              <h3 className="text-white/50 text-[10px] tracking-widest font-bold mb-2 uppercase">
                {puzzleType === 'pyraminx' ? 'ПО ЧАСОВОЙ (120°)' : 'ПО ЧАСОВОЙ (90°)'}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {moves.map((move, i) => (
                  <button
                    key={i}
                    onClick={move.action}
                    disabled={isAnimating || isAutoSolving}
                    className="bg-brand-900/50 hover:bg-brand-900/80 text-brand-50 border border-brand-500/50 py-2 px-1 rounded-xl shadow-md transition-all active:scale-95 text-xs font-bold flex items-center justify-center backdrop-blur-sm disabled:opacity-50 text-center leading-tight"
                  >
                    {move.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <h3 className="text-white/50 text-[10px] tracking-widest font-bold mb-2 uppercase">
                {puzzleType === 'pyraminx' ? 'ПРОТИВ ЧАСОВОЙ (-120°)' : 'ПРОТИВ ЧАСОВОЙ (-90°)'}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {reverseMoves.map((move, i) => (
                  <button
                    key={i}
                    onClick={move.action}
                    disabled={isAnimating || isAutoSolving}
                    className="bg-brand-900/50 hover:bg-brand-900/80 text-brand-50 border border-brand-500/50 py-2 px-1 rounded-xl shadow-md transition-all active:scale-95 text-xs font-bold flex items-center justify-center backdrop-blur-sm disabled:opacity-50 text-center leading-tight"
                  >
                    {move.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="relative bg-brand-900/50 rounded-2xl p-4 border border-brand-400/30 shadow-inner">
            <h3 className="text-brand-400 font-bold mb-3 flex items-center gap-2"><i className="fa-solid fa-fill-drip"></i> Выберите цвет</h3>
            <div className="flex bg-black/30 rounded-lg p-1 w-full text-xs font-bold shadow-inner mb-4">
              <button onClick={() => setIs2DPaintMode(false)} className={`flex-1 py-2 rounded-md transition-all ${!is2DPaintMode ? 'bg-brand-400 text-brand-900 shadow-md' : 'text-white/50 hover:text-white'}`}>3D</button>
              <button onClick={() => setIs2DPaintMode(true)} className={`flex-1 py-2 rounded-md transition-all ${is2DPaintMode ? 'bg-brand-400 text-brand-900 shadow-md' : 'text-white/50 hover:text-white'}`}>2D</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {Object.entries({
                U: { name: 'Желтый', color: 'bg-[#F2D11F]' },
                D: { name: 'Белый', color: 'bg-[#EEEEEE]' },
                F: { name: 'Зеленый', color: 'bg-[#199B35]' },
                B: { name: 'Синий', color: 'bg-[#1B5FE3]' },
                R: { name: 'Красный', color: 'bg-[#D12A2A]' },
                L: { name: 'Оранжевый', color: 'bg-[#E86B0C]' }
                }).map(([key, data]) => {
                  return (
                  <button
                    key={key}
                    onClick={() => setActivePaintColor(key as any)}
                    className={`h-12 w-full rounded-xl border-2 transition-all shadow-sm flex items-center justify-center ${data.color} ${activePaintColor === key ? 'border-brand-400 scale-110 z-10 shadow-brand-400/50 ring-4 ring-brand-400/20' : 'border-black/20 hover:scale-105'}`}
                title={`Цвет: ${data.name}`}
                  >
                  </button>
                )})}
              </div>
          </div>
        )}

        <div className="mt-auto relative flex flex-col gap-3 pt-4 border-t border-brand-500/20">
          <div className="flex gap-3">
            <button
              onClick={() => { if (puzzleType === 'pyraminx') window.dispatchEvent(new CustomEvent('pyr-reset')); else reset(); setIsAutoSolving(false); }}
              disabled={isAnimating && !isAutoSolving}
              className="flex-1 bg-brand-50/10 hover:bg-brand-50/20 text-brand-50 py-3 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 border border-brand-500/30 disabled:opacity-50"
            >
              <i className="fa-solid fa-rotate-left"></i> Сброс
            </button>
            <button
              onClick={() => { if (puzzleType === 'pyraminx') window.dispatchEvent(new CustomEvent('pyr-scramble')); else scramble(); setIsAutoSolving(false); }}
              disabled={isAnimating && !isAutoSolving}
              className="flex-1 bg-brand-400 hover:bg-brand-300 text-brand-900 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <i className="fa-solid fa-shuffle"></i> Скрембл
            </button>
          </div>

          {solveFormula.length > 0 && !isPaintMode && (
            <div className="mt-2 p-3 bg-brand-900/50 rounded-2xl border border-brand-500/30">
            <h3 className="text-white/50 text-[10px] tracking-widest font-bold mb-2 uppercase">Алгоритм скрембла</h3>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                {solveFormula.map((move, i) => (
                  <span key={i} className={`px-2 py-1 rounded bg-brand-800 text-brand-50 font-mono text-xs shadow-sm ${i === 0 && isAutoSolving ? 'ring-2 ring-brand-400 scale-110' : ''}`}>
                    {move}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {puzzleType !== 'mirror' && <button
              onClick={() => togglePaintMode()}
            disabled={isAnimating || isAutoSolving}
            className="w-full bg-brand-900/50 hover:bg-brand-900/80 text-brand-50 border border-brand-400/50 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <i className="fa-solid fa-paintbrush"></i> {isPaintMode ? 'Отменить раскраску' : 'Ввести свой узор'}
          </button>}
          {isPaintMode && (
            <button
              onClick={async () => {
                if (puzzleType === 'pyraminx') {
                   window.dispatchEvent(new CustomEvent('pyr-solve-paint'));
                   return;
                }
                try {
                  const error = await solvePaintedCube();
                  if (error) setPaintError(error);
                } catch(e) {
                  setPaintError("Не удалось найти решение. Проверьте правильность раскраски.");
                }
              }}
              className="w-full bg-gradient-to-r from-[#199B35] to-[#1B5FE3] hover:opacity-90 text-white py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 border border-white/20"
            >
              <i className="fa-solid fa-magic"></i> Найти решение
            </button>
          )}
          
          {(solveFormula.length > 0 || puzzleType === 'pyraminx') && !isPaintMode && (
            <button
              onClick={() => {
                if (puzzleType === 'pyraminx') {
                  window.dispatchEvent(new CustomEvent('pyr-solve'));
                } else {
                  setIsAutoSolving(true);
                }
              }}
              disabled={isAnimating || isAutoSolving || (puzzleType === 'pyraminx' ? isPyrSolved : isSolved)}
              className="w-full bg-gradient-to-r from-brand-400 to-[#A6609E] hover:from-brand-300 hover:to-brand-400 text-brand-900 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 border border-brand-400/50"
            >
              <i className={`fa-solid ${isAutoSolving ? 'Сборка...' : 'Автоматическая сборка'}`}></i> 
              {isAutoSolving ? 'Сборка...' : 'Автоматическая сборка'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
