import * as THREE from 'three';

let movePermutations: Record<string, Int8Array> | null = null;
let solvedColors: string[] | null = null;

function getStickerCenters(pieces: any[]): THREE.Vector3[] {
    const centers: THREE.Vector3[] = [];
    pieces.forEach(p => {
        p.stickers.forEach((st: any) => {
            const [A, B, C] = st.vertices;
            const center = A.clone().add(B).add(C).divideScalar(3);
            center.applyQuaternion(p.quaternion);
            centers.push(center);
        });
    });
    return centers;
}

export class PyraminxSolver {
    static generatePermutations(initialPieces: any[]) {
        if (movePermutations) return;
        
        const baseCenters = getStickerCenters(initialPieces);
        solvedColors = [];
        initialPieces.forEach(p => {
            p.stickers.forEach((st: any) => {
                solvedColors!.push(st.color.toUpperCase());
            });
        });

        const axes = [
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, -1/3, 2.828/3).normalize(),
            new THREE.Vector3(2.449/3, -1/3, -1.414/3).normalize(),
            new THREE.Vector3(-2.449/3, -1/3, -1.414/3).normalize()
        ];

        const moves = [
            { key: 'U', axis: 0, layer: 'block', dir: -1 },
            { key: "U'", axis: 0, layer: 'block', dir: 1 },
            { key: 'u', axis: 0, layer: 'tip', dir: -1 },
            { key: "u'", axis: 0, layer: 'tip', dir: 1 },
            
            { key: 'B', axis: 1, layer: 'block', dir: -1 },
            { key: "B'", axis: 1, layer: 'block', dir: 1 },
            { key: 'b', axis: 1, layer: 'tip', dir: -1 },
            { key: "b'", axis: 1, layer: 'tip', dir: 1 },
            
            { key: 'R', axis: 2, layer: 'block', dir: -1 },
            { key: "R'", axis: 2, layer: 'block', dir: 1 },
            { key: 'r', axis: 2, layer: 'tip', dir: -1 },
            { key: "r'", axis: 2, layer: 'tip', dir: 1 },
            
            { key: 'L', axis: 3, layer: 'block', dir: -1 },
            { key: "L'", axis: 3, layer: 'block', dir: 1 },
            { key: 'l', axis: 3, layer: 'tip', dir: -1 },
            { key: "l'", axis: 3, layer: 'tip', dir: 1 },
        ];

        movePermutations = {};

        for (const m of moves) {
            const rotQuat = new THREE.Quaternion().setFromAxisAngle(axes[m.axis], m.dir * Math.PI * 2 / 3);
            
            const getBlockPieces = (axisIndex: number, layer: 'tip' | 'block') => {
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

            const activeIds = getBlockPieces(m.axis, m.layer as 'tip'|'block');
            
            // Apply to pieces
            const testPieces = initialPieces.map(p => {
                let active = activeIds.includes(p.logicalId);
                
                if (active) {
                    return { ...p, quaternion: rotQuat.clone().multiply(p.quaternion || new THREE.Quaternion()) };
                }
                return { ...p, quaternion: p.quaternion || new THREE.Quaternion() };
            });

            const newCenters = getStickerCenters(testPieces);
            const perm = new Int8Array(36);
            
            for (let i = 0; i < 36; i++) {
                let bestMatch = -1;
                let bestDist = Infinity;
                for (let j = 0; j < 36; j++) {
                    const d = newCenters[i].distanceTo(baseCenters[j]);
                    if (d < bestDist) {
                        bestDist = d;
                        bestMatch = j;
                    }
                }
                perm[i] = bestMatch;
            }
            movePermutations[m.key] = perm;
        }
    }

    static applyPermutation(state: Int8Array, perm: Int8Array): Int8Array {
        const next = new Int8Array(36);
        for (let i = 0; i < 36; i++) {
            // perm[i] = j means sticker i moved to slot j
            // So slot j gets color from sticker i
            next[perm[i]] = state[i];
        }
        return next;
    }

    static solvePainted(piecesState: any[], initialPieces: any[]): string | null {
        this.generatePermutations(initialPieces);
        
        // Extract current colors
        const currentColors: string[] = [];
        piecesState.forEach(p => {
            p.stickers.forEach((st: any) => {
                currentColors.push(st.color.toUpperCase());
            });
        });

        // Convert current colors to state array (mapping to 0-3 based on solved colors)
        // Actually, we can just use 0, 1, 2, 3 for the 4 colors.
        const colorMap: Record<string, number> = {};
        let colorCounter = 0;
        const startState = new Int8Array(36);
        const goalState = new Int8Array(36);
        
        for (let i = 0; i < 36; i++) {
            if (colorMap[solvedColors![i]] === undefined) {
                colorMap[solvedColors![i]] = colorCounter++;
            }
            goalState[i] = colorMap[solvedColors![i]];
            
            const currCol = currentColors[i];
            if (colorMap[currCol] === undefined) colorMap[currCol] = colorCounter++;
            startState[i] = colorMap[currCol];
        }

        const isSolved = (s: Int8Array) => {
            for (let i = 0; i < 36; i++) if (s[i] !== goalState[i]) return false;
            return true;
        };

        if (isSolved(startState)) return "";

        // Bidirectional BFS
        const moves = Object.keys(movePermutations!);
        
        let fwQueue: {s: Int8Array, path: string[]}[] = [{ s: startState, path: [] }];
        const fwVisited = new Map<string, string[]>();
        fwVisited.set(startState.join(''), []);
        
        for (let depth = 1; depth <= 5; depth++) {
            const nextQ = [];
            for (const item of fwQueue) {
                for (const m of moves) {
                    if (item.path.length > 0 && item.path[item.path.length - 1].replace("'", "") === m.replace("'", "")) continue;
                    const nextS = this.applyPermutation(item.s, movePermutations![m]);
                    if (isSolved(nextS)) {
                        return [...item.path, m].join(" ");
                    }
                    const key = nextS.join('');
                    if (!fwVisited.has(key)) {
                        const newPath = [...item.path, m];
                        fwVisited.set(key, newPath);
                        nextQ.push({ s: nextS, path: newPath });
                    }
                }
            }
            fwQueue = nextQ;
        }

        // If not found in 5, do backwards from goal
        let bwQueue: {s: Int8Array, path: string[]}[] = [{ s: goalState, path: [] }];
        const bwVisited = new Map<string, string[]>();
        bwVisited.set(goalState.join(''), []);

        for (let depth = 1; depth <= 6; depth++) {
            const nextQ = [];
            for (const item of bwQueue) {
                for (const m of moves) {
                    if (item.path.length > 0 && item.path[item.path.length - 1].replace("'", "") === m.replace("'", "")) continue;
                    // Inverse move
                    const invM = m.includes("'") ? m.replace("'", "") : m + "'";
                    const nextS = this.applyPermutation(item.s, movePermutations![invM]);
                    const key = nextS.join('');
                    
                    if (fwVisited.has(key)) {
                        return [...fwVisited.get(key)!, ...[...item.path, m].reverse()].join(" ");
                    }
                    
                    if (!bwVisited.has(key)) {
                        const newPath = [...item.path, m];
                        bwVisited.set(key, newPath);
                        nextQ.push({ s: nextS, path: newPath });
                    }
                }
            }
            bwQueue = nextQ;
        }

        return null;
    }
}
