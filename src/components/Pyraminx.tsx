import { useCubeStore } from '../store/cubeStore';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PyraminxSolver } from '../utils/pyraminxSolver';
import { playCubeClick } from '../utils/audio';



const SQRT6_4 = Math.sqrt(6) / 4;
const SQRT3 = Math.sqrt(3);

const V = [
  new THREE.Vector3(0, 3 * SQRT6_4, 0),
  new THREE.Vector3(0, -SQRT6_4, SQRT3),
  new THREE.Vector3(1.5, -SQRT6_4, -SQRT3 / 2),
  new THREE.Vector3(-1.5, -SQRT6_4, -SQRT3 / 2)
];
export const AXES = V.map(v => v.clone().normalize());

const faces = [
  [0, 1, 2],
  [0, 2, 3],
  [0, 3, 1],
  [1, 3, 2]
];
const faceColors = ['#199B35', '#D12A2A', '#1B5FE3', '#F2D11F'];

// Переиспользуемые кватернионы для оптимизации анимации в Firefox
const _scratchPyrQuat = new THREE.Quaternion();
const _scratchPyrRot = new THREE.Quaternion();

function W(A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3, wA: number, wB: number, wC: number) {
  return new THREE.Vector3()
    .addScaledVector(A, wA/3)
    .addScaledVector(B, wB/3)
    .addScaledVector(C, wC/3);
}

export const initialPieces = (() => {
  const piecesMap: Record<string, any> = {};
  faces.forEach((face, fIdx) => {
    const A = V[face[0]];
    const B = V[face[1]];
    const C = V[face[2]];
    
    const addSticker = (id: string, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) => {
      if (!piecesMap[id]) piecesMap[id] = { id, quaternion: new THREE.Quaternion(), stickers: [] };
      piecesMap[id].stickers.push({ faceIndex: fIdx, color: faceColors[fIdx], vertices: [p1, p2, p3] });
    };

    addSticker(`Tip_${face[0]}`, W(A,B,C, 3,0,0), W(A,B,C, 2,1,0), W(A,B,C, 2,0,1));
    addSticker(`Edge_${Math.min(face[0], face[1])}_${Math.max(face[0], face[1])}`, W(A,B,C, 2,1,0), W(A,B,C, 1,2,0), W(A,B,C, 1,1,1));
    addSticker(`Center_${face[0]}`, W(A,B,C, 2,1,0), W(A,B,C, 1,1,1), W(A,B,C, 2,0,1));
    addSticker(`Edge_${Math.min(face[0], face[2])}_${Math.max(face[0], face[2])}`, W(A,B,C, 2,0,1), W(A,B,C, 1,1,1), W(A,B,C, 1,0,2));
    addSticker(`Tip_${face[1]}`, W(A,B,C, 1,2,0), W(A,B,C, 0,3,0), W(A,B,C, 0,2,1));
    addSticker(`Center_${face[1]}`, W(A,B,C, 1,2,0), W(A,B,C, 0,2,1), W(A,B,C, 1,1,1));
    addSticker(`Edge_${Math.min(face[1], face[2])}_${Math.max(face[1], face[2])}`, W(A,B,C, 0,2,1), W(A,B,C, 0,1,2), W(A,B,C, 1,1,1));
    addSticker(`Center_${face[2]}`, W(A,B,C, 1,1,1), W(A,B,C, 0,1,2), W(A,B,C, 1,0,2));
    addSticker(`Tip_${face[2]}`, W(A,B,C, 1,0,2), W(A,B,C, 0,1,2), W(A,B,C, 0,0,3));
  });
  return Object.values(piecesMap).map(p => {
    let count = 0;
    const centroid = new THREE.Vector3();
    p.stickers.forEach((st: any) => {
      st.vertices.forEach((v: any) => {
        centroid.add(v);
        count++;
      });
    });
    centroid.divideScalar(count);
    
      // Create ConvexGeometry for the inner solid body
      const uniqueVerts = [new THREE.Vector3(0, 0, 0)]; // Add origin to ensure 3D volume and prevent coplanar crashes
      p.stickers.forEach((st: any) => {
        st.vertices.forEach((v: any) => {
          if (!uniqueVerts.some((uv: any) => uv.distanceTo(v) < 0.001)) {
            uniqueVerts.push(v);
          }
        });      });
      // ConvexGeometry needs at least 4 non-coplanar vertices to form a 3D hull
      // Wait, a Center piece has 1 sticker (3 vertices) on the outside?
      // No! A Center piece in Pyraminx has 3 stickers! Wait, let's check.
      return { ...p, logicalId: p.id, originalCentroid: centroid, uniqueVerts };
  
  });
})();

export const getBlockPieces = (axisIndex: number, layer: 'tip' | 'block') => {
  const targetId = axisIndex.toString();
  if (layer === 'tip') return [`Tip_${targetId}`];
  
  const pieces = [`Tip_${targetId}`, `Center_${targetId}`];
  for (let i = 0; i < 4; i++) {
    if (i !== axisIndex) {
      pieces.push(`Edge_${Math.min(axisIndex, i)}_${Math.max(axisIndex, i)}`);
    }
  }
  return pieces;
};

function getValidAxes(pieceId: string): { axisIdx: number, layer: 'tip' | 'block' }[] {
  if (pieceId.startsWith('Tip_')) {
    return [{ axisIdx: parseInt(pieceId.split('_')[1]), layer: 'tip' }];
  }
  if (pieceId.startsWith('Center_')) {
    return [{ axisIdx: parseInt(pieceId.split('_')[1]), layer: 'block' }];
  }
  if (pieceId.startsWith('Edge_')) {
    const parts = pieceId.split('_');
    return [
      { axisIdx: parseInt(parts[1]), layer: 'block' },
      { axisIdx: parseInt(parts[2]), layer: 'block' }
    ];
  }
  return [];
}

function PyraminxSticker({ sticker, onPointerDown }: any) {
  const geom = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const [A, B, C] = sticker.vertices;
    const center = A.clone().add(B).add(C).divideScalar(3);
    const shrink = 0.90; 
    const sA = center.clone().add(A.clone().sub(center).multiplyScalar(shrink));
    const sB = center.clone().add(B.clone().sub(center).multiplyScalar(shrink));
    const sC = center.clone().add(C.clone().sub(center).multiplyScalar(shrink));
    
    const normal = new THREE.Vector3().crossVectors(B.clone().sub(A), C.clone().sub(A)).normalize();
    sA.addScaledVector(normal, 0.005);
    sB.addScaledVector(normal, 0.005);
    sC.addScaledVector(normal, 0.005);

    const vertices = new Float32Array([
      sA.x, sA.y, sA.z, sB.x, sB.y, sB.z, sC.x, sC.y, sC.z,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return geo;
  }, [sticker]);

  return (
    <mesh geometry={geom} onPointerDown={onPointerDown}>
      <meshStandardMaterial color={sticker.color} roughness={0.2} />
    </mesh>
  );
}
function PyraminxPieceView({ piece, animRef, dragRef }: any) {
  const groupRef = useRef<THREE.Group>(null);
  const isDirtyRef = useRef(true);
  
  const baseMesh = useMemo(() => {
    const pts = [];
    piece.stickers.forEach((st: any) => {
      pts.push(...st.vertices);
    });
    // Add origin to give volume (especially needed for coplanar center pieces)
    // Actually, adding the origin for ALL pieces creates perfect wedges that tile the whole tetrahedron!
    pts.push(new THREE.Vector3(0, 0, 0));
    
    try {
      const geo = new ConvexGeometry(pts);
      // scale it down very slightly so stickers sit on top seamlessly
      geo.scale(0.98, 0.98, 0.98);
      return geo;
    } catch (e) {
      console.error("ConvexGeometry failed", piece.logicalId, e);
      return new THREE.BufferGeometry();
    }
  }, [piece]);

  

  
  useEffect(() => {
    isDirtyRef.current = true;
  }, [piece.quaternion]);

  useFrame(() => {
    if (groupRef.current) {
      const isAnimating = animRef.current && animRef.current.activePieces.includes(piece.logicalId);
      const isDragging = dragRef.current && dragRef.current.lockedAxis;

      // Оптимизация для Firefox: если деталь не движется и позиция синхронизирована — пропускаем вычисления
      if (!isAnimating && !isDragging) {
        if (!isDirtyRef.current) return;
        isDirtyRef.current = false;
        groupRef.current.quaternion.copy(piece.quaternion);
        return;
      }
      isDirtyRef.current = true;

      _scratchPyrQuat.copy(piece.quaternion);
      
      if (isAnimating) {
        _scratchPyrRot.setFromAxisAngle(animRef.current.axis, animRef.current.currentAngle);
        _scratchPyrQuat.premultiply(_scratchPyrRot);
      } else if (isDragging) {
        const activeIds = getBlockPieces(dragRef.current.lockedAxis.axisIdx, dragRef.current.lockedAxis.layer);
        if (activeIds.includes(piece.logicalId)) {
          _scratchPyrRot.setFromAxisAngle(AXES[dragRef.current.lockedAxis.axisIdx], dragRef.current.dragAngle);
          _scratchPyrQuat.premultiply(_scratchPyrRot);
        }
      }
      
      groupRef.current.quaternion.copy(_scratchPyrQuat);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={baseMesh}>
        <meshStandardMaterial color="#111111" roughness={0.8} />
      </mesh>
      {piece.stickers.map((st: any, idx: number) => (
        <PyraminxSticker key={idx} sticker={st} onPointerDown={(e: any) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            
            const paintMode = useCubeStore.getState().isPaintMode;
            if (paintMode) {
              const colorKey = useCubeStore.getState().activePaintColor;
              const FACE_COLORS: any = { U: '#F2D11F', D: '#EEEEEE', F: '#199B35', B: '#1B5FE3', R: '#D12A2A', L: '#E86B0C' };
              window.dispatchEvent(new CustomEvent('pyr-paint-sticker', { 
                  detail: { pieceId: piece.id, stickerIdx: idx, color: FACE_COLORS[colorKey] }
              }));
              return;
            }
          if (!dragRef.current?.active && !animRef.current) {
            window.dispatchEvent(new CustomEvent('pyraminx-drag-start'));
            dragRef.current = {
              active: true,
              pieceId: piece.logicalId,
              startPoint3D: e.point.clone(),
              startMouse: new THREE.Vector2(e.clientX, e.clientY),
              currentMouse: new THREE.Vector2(e.clientX, e.clientY),
              lockedAxis: null,
              dragAngle: 0
            };
          }
        }} />
      ))}
    </group>
  );
}

export function Pyraminx() {
  

  const [piecesState, setPiecesState] = useState(initialPieces);
  const [history, setHistory] = useState<any[]>([]);
  const [isSolving, setIsSolving] = useState(false);

  const animRef = useRef<any>(null);
  const dragRef = useRef<any>(null);
  const piecesStateRef = useRef({pieces: piecesState, history: history});
  
  const { camera } = useThree();

      useEffect(() => {
    const handlePaint = (e: any) => {
      setPiecesState(prev => prev.map(p => {
        if (p.id === e.detail.pieceId) {
          const newStickers = [...p.stickers];
          newStickers[e.detail.stickerIdx] = { ...newStickers[e.detail.stickerIdx], color: e.detail.color };
          return { ...p, stickers: newStickers };
        }
        return p;
      }));
    };
    window.addEventListener('pyr-paint-sticker', handlePaint);
    return () => window.removeEventListener('pyr-paint-sticker', handlePaint);
  }, []);

  useEffect(() => {
    piecesStateRef.current = {pieces: piecesState, history: history}; 
    
    // Check solved state by colors
      let solved = true;
      // Let's use a simpler approach: 
      // Compare the current stickers' 3D positions with the initialPieces' 3D positions!
      // If every sticker matches the color of the initial sticker at that 3D position, it's solved!
      
      const getCenters = (pieces: any[]) => {
          const centers: THREE.Vector3[] = [];
          const colors: string[] = [];
          pieces.forEach(p => {
              p.stickers.forEach((st: any) => {
                  const [A, B, C] = st.vertices;
                  const center = A.clone().add(B).add(C).divideScalar(3);
                  center.applyQuaternion(p.quaternion);
                  centers.push(center);
                  colors.push(st.color.toUpperCase());
              });
          });
          return {centers, colors};
      };
      
      const curr = getCenters(piecesState);
      const init = getCenters(initialPieces);
      
      for (let i = 0; i < 36; i++) {
          // Find the matching position in init
          let matchIdx = -1;
          let minDist = Infinity;
          for (let j = 0; j < 36; j++) {
              const d = curr.centers[i].distanceTo(init.centers[j]);
              if (d < minDist) {
                  minDist = d;
                  matchIdx = j;
              }
          }
          if (curr.colors[i] !== init.colors[matchIdx]) {
              solved = false;
              break;
          }
      }
    
    if (solved && history.length > 0) {
      window.dispatchEvent(new CustomEvent('pyr-solved'));
    }
    
    window.dispatchEvent(new CustomEvent('pyr-state-update', { 
      detail: { moveCount: history.length, isSolved: solved }
    }));
  }, [piecesState, history]);

  const executeMove = (move: string, saveToHistory = true) => {
    if (animRef.current) return;
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
        case 'R': axisIdx = 2; layer = 'block'; break;
        case 'r': axisIdx = 2; layer = 'tip'; break;
        case 'L': axisIdx = 3; layer = 'block'; break;
        case 'l': axisIdx = 3; layer = 'tip'; break;
    }

    if (axisIdx !== -1) {
        const targetId = axisIdx.toString();
        let pieces = [];
        if (layer === 'tip') {
            pieces = ['Tip_' + targetId];
        } else {
            pieces = ['Tip_' + targetId, 'Center_' + targetId];
            for (let j = 0; j < 4; j++) {
                if (j !== axisIdx) {
                    pieces.push('Edge_' + Math.min(axisIdx, j) + '_' + Math.max(axisIdx, j));
                }
            }
        }
        
        animRef.current = {
            axis: AXES[axisIdx],
            activePieces: pieces,
            targetAngle: (Math.PI * 2 / 3) * dir,
            currentAngle: 0,
            speed: 10,
            historyMove: saveToHistory ? move : null
        };
    }
  };

  useEffect(() => {
    const handleSolve = () => {
      if (piecesStateRef.current.history && piecesStateRef.current.history.length === 0) return;
      setIsSolving(true);
      let step = piecesStateRef.current.history.length - 1;
      
      const interval = setInterval(() => {
        if (!animRef.current) {
          if (step < 0) {
            clearInterval(interval);
            setIsSolving(false);
            // setHistory([]); DO NOT CLEAR HISTORY SO SUCCESS WINDOW APPEARS
            window.dispatchEvent(new CustomEvent('pyr-solved'));
            return;
          }
          const move = piecesStateRef.current.history[step];
          const invMove = move.includes("'") ? move.replace("'", "") : move + "'";
          executeMove(invMove, false);
          step--;
        }
      }, 100); // 100ms looks better for animation
    };

    const handleScramble = () => {
      if (animRef.current) return;
      setHistory([]);
      const possibleMoves = ['U', "U'", 'u', "u'", 'L', "L'", 'l', "l'", 'R', "R'", 'r', "r'", 'B', "B'", 'b', "b'"];
      
      let st = [...piecesStateRef.current.pieces];
      const newHistory = [];
      
      for (let i = 0; i < 15; i++) {
        const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        newHistory.push(move);
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
            case 'R': axisIdx = 2; layer = 'block'; break;
            case 'r': axisIdx = 2; layer = 'tip'; break;
            case 'L': axisIdx = 3; layer = 'block'; break;
            case 'l': axisIdx = 3; layer = 'tip'; break;
        }

        const targetId = axisIdx.toString();
        let pieces = [];
        if (layer === 'tip') {
            pieces = ['Tip_' + targetId];
        } else {
            pieces = ['Tip_' + targetId, 'Center_' + targetId];
            for (let j = 0; j < 4; j++) {
                if (j !== axisIdx) {
                    pieces.push('Edge_' + Math.min(axisIdx, j) + '_' + Math.max(axisIdx, j));
                }
            }
        }
        
        const q = new THREE.Quaternion().setFromAxisAngle(AXES[axisIdx], (Math.PI * 2 / 3) * dir);
        st = st.map(p => {
          if (pieces.includes(p.logicalId)) {
            const nextP = { ...p, quaternion: q.clone().multiply(p.quaternion) };
            const currentCentroid = nextP.originalCentroid.clone().applyQuaternion(nextP.quaternion);
            let closestId = nextP.logicalId;
            let minDist = Infinity;
            initialPieces.forEach(initP => {
              const dist = initP.originalCentroid.distanceTo(currentCentroid);
              if (dist < minDist) {
                minDist = dist;
                closestId = initP.id;
              }
            });
            nextP.logicalId = closestId;
            return nextP;
          }
          return p;
        });
      }
      setPiecesState(st);
      setHistory(newHistory);
    };

    const handleReset = () => {
      setPiecesState(initialPieces);
      setHistory([]);
      setIsSolving(false);
    };

    const handlePyrMove = (e: any) => {
      executeMove(e.detail, true);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragRef.current || !dragRef.current.active) return;
      dragRef.current.currentMouse.set(e.clientX, e.clientY);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragRef.current || !dragRef.current.active) return;
      const drag = dragRef.current;
      if (drag.lockedAxis) {
         let snaps = Math.round(drag.dragAngle / (Math.PI * 2 / 3));
         let targetAngle = snaps * (Math.PI * 2 / 3);
         let moveStr = null;
         if (snaps !== 0) {
            const keys = ['U', 'B', 'R', 'L'];
            let baseKey = keys[drag.lockedAxis.axisIdx];
            if (drag.lockedAxis.layer === 'tip') baseKey = baseKey.toLowerCase();
            moveStr = snaps > 0 ? baseKey : baseKey + "'";
         }
         animRef.current = {
           activePieces: getBlockPieces(drag.lockedAxis.axisIdx, drag.lockedAxis.layer),
           axis: AXES[drag.lockedAxis.axisIdx],
           currentAngle: drag.dragAngle,
           targetAngle: targetAngle,
           speed: 10,
           historyMove: moveStr
         };
      }
      window.dispatchEvent(new CustomEvent('pyraminx-drag-end'));
      dragRef.current = null;
    };

    
    const handleSolvePaint = () => {
      if (!piecesStateRef.current.history || piecesStateRef.current.history.length === 0) {
        // Find solution using BFS
        const solution = PyraminxSolver.solvePainted(piecesStateRef.current.pieces, initialPieces);
        if (solution === null) {
            window.dispatchEvent(new CustomEvent('pyr-paint-error', { 
               detail: { message: '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0439\u0442\u0438 \u0440\u0435\u0448\u0435\u043D\u0438\u0435. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0440\u0430\u0441\u043A\u0440\u0430\u0441\u043A\u0438.' }
            }));
            return;
        } else if (solution === "") {
            window.dispatchEvent(new CustomEvent('pyr-paint-error', { 
               detail: { message: '\u041F\u0438\u0440\u0430\u043C\u0438\u0434\u043A\u0430 \u0443\u0436\u0435 \u0441\u043E\u0431\u0440\u0430\u043D\u0430!' }
            }));
            return;
        }
        
        // Reverse the solution to get a history (since handleSolve replays history in reverse)
        // Wait! `solution` is a string of moves to SOLVE the pyraminx.
        // E.g. "U R L'".
        // But `handleSolve` does: `const invMove = move.includes("'") ? move.replace("'", "") : move + "'"; executeMove(invMove)`
        // So `handleSolve` applies the INVERSE of the moves in `history` from end to start.
        // So `history` represents the SCRAMBLE sequence!
        // To make `handleSolve` apply "U R L'", we need `history` to be the INVERSE sequence, in REVERSE order.
        // Wait, if solution is "U R L'", applying it in order is U, then R, then L'.
        // `handleSolve` reads from end of history to start.
        // So if history is ["U'", "R'", "L"], then step goes from 2 down to 0.
        // step 2: history[2] = "L", invMove = "L'". execute "L'".
        // step 1: history[1] = "R'", invMove = "R". execute "R".
        // step 0: history[0] = "U'", invMove = "U". execute "U".
        // Wait, applying L' then R then U is NOT U then R then L'!
        // If we want U, R, L', we need step 2 = U, step 1 = R, step 0 = L'.
        // So history[2]' = U => history[2] = U'
        // history[1]' = R => history[1] = R'
        // history[0]' = L' => history[0] = L
        // So history = ["L", "R'", "U'"].
        
        const moves = solution.split(' ').filter(m => m);
        const historySeq = [...moves].reverse().map(m => m.includes("'") ? m.replace("'", "") : m + "'");
        setHistory(historySeq);
        piecesStateRef.current.history = historySeq;
        
        // Disable paint mode in store
          useCubeStore.getState().setCubeFromSolveAlgorithm(moves);
          useCubeStore.setState({ isPaintMode: false }); 
        
        // setTimeout(() => handleSolve(), 50);
        return;
      }
      handleSolve();
    };

    window.addEventListener('pyr-solve', handleSolve);
    window.addEventListener('pyr-solve-paint', handleSolvePaint);
    window.addEventListener('pyr-scramble', handleScramble);
    window.addEventListener('pyr-reset', handleReset);
    window.addEventListener('pyr-move', handlePyrMove);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      window.removeEventListener('pyr-solve', handleSolve);
      window.removeEventListener('pyr-solve-paint', handleSolvePaint);
      window.removeEventListener('pyr-scramble', handleScramble);
      window.removeEventListener('pyr-reset', handleReset);
      window.removeEventListener('pyr-move', handlePyrMove);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (animRef.current) {
      const anim = animRef.current;
      const diff = anim.targetAngle - anim.currentAngle;
      
      if (Math.abs(diff) < 0.01) {
         anim.currentAngle = anim.targetAngle;
         playCubeClick();
         const rotQuat = new THREE.Quaternion().setFromAxisAngle(anim.axis, anim.targetAngle);
         if (anim.historyMove) {
           setHistory(prev => [...prev, anim.historyMove]);
         }
         setPiecesState(prev => {
           const nextState = prev.map(p => {
             if (anim.activePieces.includes(p.logicalId)) {
               return { ...p, quaternion: rotQuat.clone().multiply(p.quaternion) };
             }
             return p;
           });
           
           nextState.forEach(p => {
             if (anim.activePieces.includes(p.logicalId)) {
               const currentCentroid = p.originalCentroid.clone().applyQuaternion(p.quaternion);
               let closestId = p.logicalId;
               let minDist = Infinity;
               initialPieces.forEach(initP => {
                 const dist = initP.originalCentroid.distanceTo(currentCentroid);
                 if (dist < minDist) {
                   minDist = dist;
                   closestId = initP.id;
                 }
               });
               p.logicalId = closestId;
             }
           });
           return nextState;
         });
         animRef.current = null;
      } else {
         anim.currentAngle += diff * 15 * delta;
      }
    }
    
    if (dragRef.current && dragRef.current.active) {
      const drag = dragRef.current;
      const deltaMouse = new THREE.Vector2().subVectors(drag.currentMouse, drag.startMouse);
      
      if (!drag.lockedAxis && deltaMouse.length() > 5) {
        const validAxes = getValidAxes(drag.pieceId);
        let bestAxis = validAxes[0];
        let maxDot = -1;
        
        validAxes.forEach(ax => {
          const A = AXES[ax.axisIdx];
          const expected3D = new THREE.Vector3().crossVectors(A, drag.startPoint3D).normalize();
          
          const pt1 = drag.startPoint3D.clone().project(camera);
          const pt2 = drag.startPoint3D.clone().add(expected3D.multiplyScalar(0.1)).project(camera);
          
          const screenDelta = new THREE.Vector2(pt2.x - pt1.x, -(pt2.y - pt1.y)).normalize();
          const mouseNorm = deltaMouse.clone().normalize();
          const dot = screenDelta.dot(mouseNorm);
          
          if (Math.abs(dot) > maxDot) {
            maxDot = Math.abs(dot);
            bestAxis = ax;
          }
        });
        
        drag.lockedAxis = bestAxis;
      }
      
      if (drag.lockedAxis) {
        const A = AXES[drag.lockedAxis.axisIdx];
        const expected3D = new THREE.Vector3().crossVectors(A, drag.startPoint3D).normalize();
        const pt1 = drag.startPoint3D.clone().project(camera);
        const pt2 = drag.startPoint3D.clone().add(expected3D.multiplyScalar(0.1)).project(camera);
        const screenDelta = new THREE.Vector2(pt2.x - pt1.x, -(pt2.y - pt1.y)).normalize();
        
        const proj = deltaMouse.dot(screenDelta);
        let angle = proj * 0.01; 
        
        if (angle > Math.PI) angle = Math.PI;
        if (angle < -Math.PI) angle = -Math.PI;
        
        drag.dragAngle = angle;
      }
    }
  });

  return (
    <group>
      
      {piecesState.map((p) => (
        <PyraminxPieceView key={p.id} piece={p} animRef={animRef} dragRef={dragRef} />
      ))}
    </group>
  );
}
