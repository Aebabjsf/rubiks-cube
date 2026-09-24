import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { boxArgs, stickerGeometry, materials } from '../utils/cubeStyles';

interface MiniCubie {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  initX: number;
  initY: number;
  initZ: number;
}

function generateInitialCubies(reverseMoves: {axis: 'x'|'y'|'z', val: number, dir: 1|-1}[] = [], puzzleType = '3x3', preScrambleMoves: {axis: 'x'|'y'|'z', val: number, dir: 1|-1}[] = []) {
  let cubies: MiniCubie[] = [];
  
  const coords = puzzleType === '2x2' ? [-1, 1] : [-1, 0, 1];
  for (let x of coords) {
    for (let y of coords) {
      for (let z of coords) {

        cubies.push({
          id: `${x}-${y}-${z}`,
          position: new THREE.Vector3(x, y, z),
          rotation: new THREE.Euler(0, 0, 0),
          initX: x, initY: y, initZ: z
        });
      }
    }
  }
  
  // Apply preScramble context first (stage-appropriate state)
  for (const move of preScrambleMoves) {
    cubies = applyRotationSync(cubies, move.axis, move.val, move.dir);
  }
  // Then apply reverse of algorithm to set up start state
  for (const move of reverseMoves) {
    cubies = applyRotationSync(cubies, move.axis, move.val, move.dir);
  }
  
  return cubies;
}

function parseMove(moveStr: string) {
  const axisMap: Record<string, 'x'|'y'|'z'> = { R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' };
  const valMap: Record<string, number> = { U: 1, D: -1, R: 1, L: -1, F: 1, B: -1 };
  const base = moveStr[0];
  const axis = axisMap[base];
  const val = valMap[base];
  let isPrime = moveStr.includes("'");
  const isDouble = moveStr.includes("2");
  
  let dir: 1|-1 = 1;
  if (base === 'U' || base === 'R' || base === 'F') {
    dir = isPrime ? 1 : -1;
  } else {
    dir = isPrime ? -1 : 1;
  }
  return { axis, val, dir, isDouble };
}

function applyRotationSync(cubies: MiniCubie[], axis: 'x'|'y'|'z', value: number, direction: 1|-1): MiniCubie[] {
  const angle = (Math.PI / 2) * direction;
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

function isIrrelevant(step: number, name: string, x: number, y: number, z: number) {
  // Center pieces are NEVER irrelevant
  if (Math.abs(x) + Math.abs(y) + Math.abs(z) <= 1) return false;

  if (step === 2) {
    // Step 2 solves white corners (y=-1, x=1, z=1).
    if (y === 1) return true; // top layer
    if (y === 0) return true; // middle edges
    // Other bottom corners are irrelevant
    if (y === -1 && Math.abs(x) === 1 && Math.abs(z) === 1) {
       // Target corner for R U R' U' is (1, -1, 1). Don't grey it out!
       if (x === 1 && z === 1) return false;
       return true;
    }
    return false;
  }
  if (step === 3) {
    // Step 3 solves second layer edges.
    if (y === 1) return true;
    if (y === 0) {
      // "Направо" targets (1, 0, 1). "Налево" targets (-1, 0, 1).
      if (name === "Направо" && x === 1 && z === 1) return false;
      if (name === "Налево" && x === -1 && z === 1) return false;
      return true; // other middle edges are irrelevant
    }
    return false;
  }
  if (step === 4 || step === 5) {
    // Step 4 (Yellow cross) and 5 (Align cross).
    // Yellow corners are irrelevant.
    if (y === 1 && Math.abs(x) === 1 && Math.abs(z) === 1) return true;
    return false;
  }
  // For Step 6 & 7, nothing is irrelevant (need to look at all colors).
  return false;
}

function MiniCubieMesh({ cubie, animState, step, name, puzzleType = '3x3', affectedSlices }: { cubie: MiniCubie, animState: any, step: number, name: string, puzzleType?: string, affectedSlices?: Set<string> }) {
  const groupRef = useRef<THREE.Group>(null);
  const offset = puzzleType === '2x2' ? 0.996 : 0.496;

  useFrame(() => {
    if (!groupRef.current) return;
    const basePos = cubie.position.clone();
    const baseQuat = new THREE.Quaternion().setFromEuler(cubie.rotation);
    
    if (animState.isAnimating && Math.round((cubie.position as any)[animState.axis]) === animState.val) {
       const rotQuat = new THREE.Quaternion().setFromAxisAngle(
         new THREE.Vector3(animState.axis === 'x'?1:0, animState.axis === 'y'?1:0, animState.axis === 'z'?1:0),
         animState.angle
       );
       const finalPos = basePos.clone().applyQuaternion(rotQuat);
       const finalQuat = rotQuat.clone().multiply(baseQuat);
       groupRef.current.position.copy(finalPos);
       groupRef.current.quaternion.copy(finalQuat);
    } else {
       groupRef.current.position.copy(basePos);
       groupRef.current.quaternion.copy(baseQuat);
    }
  });

  let isGrey = false;
  if (puzzleType === '2x2' && affectedSlices) {
    // Grey if none of the cubie's coordinates are in an affected slice
    const x = cubie.initX, y = cubie.initY, z = cubie.initZ;
    isGrey = !affectedSlices.has(`x${x}`) && !affectedSlices.has(`y${y}`) && !affectedSlices.has(`z${z}`);
  } else if (puzzleType === '3x3' || !puzzleType) {
    isGrey = isIrrelevant(step, name, cubie.initX, cubie.initY, cubie.initZ);
  }
  const getMat = (defaultMat: THREE.Material) => puzzleType === 'mirror' ? materials.X : (isGrey ? materials.X : defaultMat);

  return (
    <group ref={groupRef}>
      <RoundedBox args={puzzleType === '2x2' ? [1.96, 1.96, 1.96] : boxArgs} radius={0.06} smoothness={4} material={materials.base} />
      {cubie.initX === 1 && <group position={[offset, 0, 0]} rotation={[0, Math.PI / 2, 0]}><mesh geometry={stickerGeometry} scale={puzzleType === '2x2' ? [2, 2, 1] : [1, 1, 1]} material={getMat(materials.R)} /></group>}
      {cubie.initX === -1 && <group position={[-offset, 0, 0]} rotation={[0, -Math.PI / 2, 0]}><mesh geometry={stickerGeometry} scale={puzzleType === '2x2' ? [2, 2, 1] : [1, 1, 1]} material={getMat(materials.L)} /></group>}
      {cubie.initY === 1 && <group position={[0, offset, 0]} rotation={[-Math.PI / 2, 0, 0]}><mesh geometry={stickerGeometry} scale={puzzleType === '2x2' ? [2, 2, 1] : [1, 1, 1]} material={getMat(materials.U)} /></group>}
      {cubie.initY === -1 && <group position={[0, -offset, 0]} rotation={[Math.PI / 2, 0, 0]}><mesh geometry={stickerGeometry} scale={puzzleType === '2x2' ? [2, 2, 1] : [1, 1, 1]} material={getMat(materials.D)} /></group>}
      {cubie.initZ === 1 && <group position={[0, 0, offset]} rotation={[0, 0, 0]}><mesh geometry={stickerGeometry} scale={puzzleType === '2x2' ? [2, 2, 1] : [1, 1, 1]} material={getMat(materials.F)} /></group>}
      {cubie.initZ === -1 && <group position={[0, 0, -offset]} rotation={[0, Math.PI, 0]}><mesh geometry={stickerGeometry} scale={puzzleType === '2x2' ? [2, 2, 1] : [1, 1, 1]} material={getMat(materials.B)} /></group>}
    </group>
  );
}

export function AlgorithmViewer({ algo, step, name, puzzleType = '3x3', preScramble = '' }: { algo: string, step: number, name: string, puzzleType?: string, preScramble?: string }) {
  // Extract clean move list
  let moveStr = algo.trim();
  if (moveStr.includes(':')) {
    moveStr = moveStr.split(':')[1].trim();
  }
  // clean up new lines and extra spaces
  moveStr = moveStr.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  const moves = moveStr.split(' ').filter(m => m.length > 0 && ['U','D','R','L','F','B'].includes(m[0]));
  
  // Create reverse moves sequence to set up the initial scramble state
  const reverseMoves = useMemo(() => {
    const parsedMoves = moves.map(parseMove);
    const reversed = [];
    // Go backwards through the algorithm
    for (let i = parsedMoves.length - 1; i >= 0; i--) {
      const m = parsedMoves[i];
      // Reverse the direction
      reversed.push({ axis: m.axis, val: m.val, dir: (m.dir * -1) as 1|-1 });
      // If it's a double move (e.g. U2), we need to do it twice
      if (m.isDouble) {
        reversed.push({ axis: m.axis, val: m.val, dir: (m.dir * -1) as 1|-1 });
      }
    }
    return reversed;
  }, [moves]);


  // Parse preScramble context moves
  const preScrambleMoves = useMemo(() => {
    if (!preScramble) return [];
    const psStr = preScramble.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const psMoves = psStr.split(' ').filter(m => m.length > 0 && ['U','D','R','L','F','B'].includes(m[0]));
    const result: {axis: 'x'|'y'|'z', val: number, dir: 1|-1}[] = [];
    for (const m of psMoves) {
      const p = parseMove(m);
      result.push({ axis: p.axis, val: p.val, dir: p.dir });
      if (p.isDouble) result.push({ axis: p.axis, val: p.val, dir: p.dir });
    }
    return result;
  }, [preScramble]);

  // Compute which axis-values are touched by this algorithm (for 2x2 greying)
  const affectedSlices = useMemo(() => {
    const s = new Set<string>();
    for (const m of reverseMoves) {
      s.add(`${m.axis}${m.val}`);
    }
    return s;
  }, [reverseMoves]);

  const [cubies, setCubies] = useState<MiniCubie[]>(() => generateInitialCubies(reverseMoves, puzzleType, preScrambleMoves));
  const animStateRef = useRef({ isAnimating: false, axis: 'x', val: 0, dir: 1, angle: 0, targetAngle: 0 });
  
  const moveIndexRef = useRef(0);
  const pauseTimerRef = useRef(1.0); // Initial pause

  useFrame((_, delta) => {
    if (moves.length === 0) return;
    
    if (pauseTimerRef.current > 0) {
      pauseTimerRef.current -= delta;
      return;
    }

    const state = animStateRef.current;
    
    if (!state.isAnimating) {
      if (moveIndexRef.current >= moves.length) {
        // Reset after 1.5 seconds and loop
        pauseTimerRef.current = 1.5;
        moveIndexRef.current = 0;
        setCubies(generateInitialCubies(reverseMoves, puzzleType, preScrambleMoves));
        return;
      }
      
      const move = moves[moveIndexRef.current];
      const parsed = parseMove(move);
      state.isAnimating = true;
      state.axis = parsed.axis;
      state.val = parsed.val;
      state.dir = parsed.dir;
      state.angle = 0;
      state.targetAngle = (Math.PI / 2) * parsed.dir * (parsed.isDouble ? 2 : 1);
    } else {
      const speed = 7.0; // rotation speed
      let nextAngle = state.angle + (speed * delta * state.dir);
      let finished = false;

      if ((state.dir > 0 && nextAngle >= state.targetAngle) || (state.dir < 0 && nextAngle <= state.targetAngle)) {
        nextAngle = state.targetAngle;
        finished = true;
      }

      state.angle = nextAngle;

      if (finished) {
        state.isAnimating = false;
        // Apply to logical state
        setCubies(prev => {
          let updated = applyRotationSync(prev, state.axis as any, state.val, state.dir as any);
          if (Math.abs(state.targetAngle) >= 3.0) { // Math.PI = 3.14
             updated = applyRotationSync(updated, state.axis as any, state.val, state.dir as any);
          }
          return updated;
        });
        moveIndexRef.current += 1;
        pauseTimerRef.current = 0.3; // tiny pause between moves
      }
    }
  });

  return (
    <group scale={puzzleType === '2x2' ? 0.5 : 1}>
      {cubies.map(cubie => (
        <MiniCubieMesh key={cubie.id} cubie={cubie} animState={animStateRef.current} step={step} name={name} puzzleType={puzzleType} affectedSlices={affectedSlices} />
      ))}
    </group>
  );
}


import { initialPieces, getBlockPieces, AXES } from './Pyraminx';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { extend } from '@react-three/fiber';
extend({ ConvexGeometry });


function PyraminxViewerPiece({ p, animRef }: { p: any, animRef: any }) {
  const groupRef = useRef<THREE.Group>(null);
  
  const { stickerGeoms, baseGeom } = useMemo(() => {
     const sGeoms = p.stickers.map((st: any) => {
        const geom = new THREE.BufferGeometry();
        const centroid2D = new THREE.Vector3();
        st.vertices.forEach((v: any) => centroid2D.add(v));
        centroid2D.divideScalar(st.vertices.length);
        const shrunkVerts = st.vertices.map((v: any) => new THREE.Vector3().copy(v).lerp(centroid2D, 0.08));
        const verts = new Float32Array(shrunkVerts.flatMap((v: any) => [v.x, v.y, v.z]));
        geom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        geom.computeVertexNormals();
        return geom;
     });
     
     const pts = p.uniqueVerts.map((v: any) => new THREE.Vector3(v.x, v.y, v.z));
     const geo = new ConvexGeometry(pts);
     if (p.originalCentroid) {
         geo.translate(-p.originalCentroid.x, -p.originalCentroid.y, -p.originalCentroid.z);
         geo.scale(0.94, 0.94, 0.94);
         geo.translate(p.originalCentroid.x, p.originalCentroid.y, p.originalCentroid.z);
     } else {
         geo.scale(0.98, 0.98, 0.98);
     }
     return { stickerGeoms: sGeoms, baseGeom: geo };
  }, [p.logicalId]); // Only compute once per piece ID

  useFrame(() => {
     if (!groupRef.current) return;
     let curQ = new THREE.Quaternion().fromArray(p.quat);
     if (animRef.current && animRef.current.pieces.includes(p.logicalId)) {
        const rotQuat = new THREE.Quaternion().setFromAxisAngle(AXES[animRef.current.axisIdx], animRef.current.angle);
        curQ = rotQuat.multiply(curQ);
     }
     groupRef.current.quaternion.copy(curQ);
  });

  return (
     <group ref={groupRef}>
       {p.stickers.map((st: any, i: number) => {
          const color = st.color || '#333';
          return <mesh key={i} geometry={stickerGeoms[i]}><meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.1} metalness={0.1} /></mesh>;
       })}
       <mesh geometry={baseGeom}>
         <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
       </mesh>
     </group>
  );
}
export function PyraminxViewer({ algo, step, name }: { algo: string, step: number, name: string }) {
  const [piecesState, setPiecesState] = useState(initialPieces);
  const animRef = useRef<any>(null);
  const piecesRef = useRef(initialPieces);
  const getActivePieces = (axisIdx: number, layer: string, piecesList: any[]) => {
      const dotThreshold = layer === 'tip' ? 1.0 : 0.3;
      return piecesList.filter((p: any) => {
         const q = new THREE.Quaternion().fromArray(p.quat);
         const currentCentroid = p.originalCentroid.clone().applyQuaternion(q);
         return currentCentroid.dot(AXES[axisIdx]) > dotThreshold;
      }).map((p: any) => p.logicalId);
  };


  const moveStr = algo.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const moves = moveStr.split(' ').filter((m: string) => m.length > 0);
  
  const moveIndexRef = useRef(0);
  const pauseTimerRef = useRef(1.0);

  useEffect(() => {
    let currentPieces = initialPieces.map((p: any) => ({ ...p, quat: p.quaternion ? p.quaternion.toArray() : [0,0,0,1] }));
    
    const reversed = [];
    for (let i = moves.length - 1; i >= 0; i--) {
       let m = moves[i];
       reversed.push(m.includes("'") ? m.replace("'", "") : m + "'");
    }
    
    for (const move of reversed) {
        const isPrime = move.includes("'");
        const baseKey = move.replace("'", "");
        const dir = isPrime ? 1 : -1;
        let axisIdx = -1;
        let layer = 'block';
        switch(baseKey) {
            case 'U': axisIdx = 0; layer = 'block'; break;
            case 'u': axisIdx = 0; layer = 'tip'; break;
            case 'B': axisIdx = 1; layer = 'block'; break;
            case 'b': axisIdx = 1; layer = 'tip'; break;
            case 'R': axisIdx = 3; layer = 'block'; break;
            case 'r': axisIdx = 3; layer = 'tip'; break;
            case 'L': axisIdx = 2; layer = 'block'; break;
            case 'l': axisIdx = 2; layer = 'tip'; break;
        }
        if (axisIdx === -1) continue;
        
        const pieces = getActivePieces(axisIdx, layer, currentPieces);
        
        const rotQuat = new THREE.Quaternion().setFromAxisAngle(AXES[axisIdx], (Math.PI * 2 / 3) * dir);
        const rotMat = new THREE.Matrix4().makeRotationFromQuaternion(rotQuat);
        
        currentPieces = currentPieces.map((p: any) => {
           if (pieces.includes(p.logicalId)) {
               const curQ = new THREE.Quaternion().fromArray(p.quat);
               const newQ = rotQuat.clone().multiply(curQ);
               return { ...p, quat: newQ.toArray() };
           }
           return p;
        });
    }
    piecesRef.current = currentPieces;
    setPiecesState(currentPieces);
  }, [algo]);

  useFrame((_, delta) => {
    if (moves.length === 0) return;
    if (pauseTimerRef.current > 0) {
      pauseTimerRef.current -= delta;
      return;
    }

    if (!animRef.current) {
      if (moveIndexRef.current >= moves.length) {
        pauseTimerRef.current = 1.5;
        moveIndexRef.current = 0;
        setPiecesState(piecesRef.current);
        return;
      }
      
      const move = moves[moveIndexRef.current];
      const isPrime = move.includes("'");
      const baseKey = move.replace("'", "");
      const dir = isPrime ? 1 : -1;
      
      let axisIdx = -1;
      let layer = 'block';
      switch(baseKey) {
          case 'U': axisIdx = 0; layer = 'block'; break;
          case 'u': axisIdx = 0; layer = 'tip'; break;
          case 'B': axisIdx = 1; layer = 'block'; break;
          case 'b': axisIdx = 1; layer = 'tip'; break;
          case 'R': axisIdx = 3; layer = 'block'; break;
          case 'r': axisIdx = 3; layer = 'tip'; break;
          case 'L': axisIdx = 2; layer = 'block'; break;
          case 'l': axisIdx = 2; layer = 'tip'; break;
      }

      if (axisIdx !== -1) {
          const pieces = getActivePieces(axisIdx, layer, piecesRef.current);
          animRef.current = { axisIdx, pieces, dir, angle: 0, targetAngle: (Math.PI * 2 / 3) * dir, speed: 7.0 };
      } else {
         moveIndexRef.current++;
      }
    } else {
       const anim = animRef.current;
       let nextAngle = anim.angle + (anim.speed * delta * anim.dir);
       let finished = false;
       if ((anim.dir > 0 && nextAngle >= anim.targetAngle) || (anim.dir < 0 && nextAngle <= anim.targetAngle)) {
           nextAngle = anim.targetAngle;
           finished = true;
       }
       anim.angle = nextAngle;
       
       if (finished) {
           const rotQuat = new THREE.Quaternion().setFromAxisAngle(AXES[anim.axisIdx], anim.targetAngle);
           const rotMat = new THREE.Matrix4().makeRotationFromQuaternion(rotQuat);
           
           setPiecesState((prev: any) => {
               const next = prev.map((p: any) => {
                   if (anim.pieces.includes(p.logicalId)) {
                       const curQ = new THREE.Quaternion().fromArray(p.quat);
                       const newQ = rotQuat.clone().multiply(curQ);
                       return { ...p, quat: newQ.toArray() };
                   }
                   return p;
               });
               piecesRef.current = next;
               return next;
           });
           
           animRef.current = null;
           moveIndexRef.current++;
           pauseTimerRef.current = 0.3;
       }
    }
  });

  return (
    <group position={[0, -0.5, 0]} rotation={[0, Math.PI, 0]}>
      {piecesState.map((p: any) => (
         <PyraminxViewerPiece key={p.logicalId} p={p} animRef={animRef} />
      ))}
    </group>
  );
}
export function AlgorithmModal({ algo, name, step, puzzleType = '3x3', preScramble = '', onClose }: { algo: string, name: string, step: number, puzzleType?: string, preScramble?: string, onClose: () => void }) {
  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-brand-900 rounded-3xl p-6 shadow-2xl border border-brand-400/30 w-full max-w-lg flex flex-col relative overflow-hidden animate-in fade-in zoom-in duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-brand-50 hover:bg-brand-400 hover:text-brand-900 transition-colors"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
        
        <h3 className="text-xl font-bold text-brand-50 mb-2 text-center">3D Демонстрация ({name})</h3>
        <p className="text-center font-mono text-brand-400 font-bold bg-black/30 py-2 rounded-xl border border-brand-500/20 mb-4">{algo}</p>
        
        <div className="w-full h-80 rounded-2xl overflow-hidden bg-black/40 border border-brand-500/20 shadow-inner relative touch-none" onContextMenu={e => e.preventDefault()}>
          <Canvas camera={{ position: [5, 4, 6], fov: 45 }}>
            <ambientLight intensity={0.9} />
            <directionalLight position={[10, 15, 10]} intensity={1.5} />
            <directionalLight position={[-10, -10, -10]} intensity={0.8} />
            
            {puzzleType === 'pyraminx' ? (
              <PyraminxViewer algo={algo} step={step} name={name} />
            ) : (
              <AlgorithmViewer algo={algo} step={step} name={name} puzzleType={puzzleType} preScramble={preScramble} />
            )}

            <OrbitControls enablePan={false} enableZoom={false} />
          </Canvas>
        </div>
        <p className="text-center text-brand-50/50 text-sm mt-4">
          <i className="fa-solid fa-rotate mr-2"></i> Вращайте кубик мышкой или свайпом, чтобы рассмотреть движение
        </p>
      </div>
    </div>
  );
}

