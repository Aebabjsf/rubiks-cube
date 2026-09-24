import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as THREE from 'three';

// Интерфейс для одного маленького кубика (одной из 26 деталей кубика Рубика)
export interface Cubie {
  id: string; // Уникальный идентификатор (например, "-1-1-1")
  position: THREE.Vector3; // Текущая позиция в 3D пространстве
  rotation: THREE.Euler; // Текущие углы поворота
  initialPosition: THREE.Vector3; // Исходная позиция (нужна для проверки "собранности" кубика)
}

// Генерация начального состояния кубика Рубика (3x3x3 = 27 деталей, минус 1 центральная = 26)
const INITIAL_CUBIES: Cubie[] = [];
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      INITIAL_CUBIES.push({
        id: `${x}-${y}-${z}`,
        position: new THREE.Vector3(x, y, z),
        rotation: new THREE.Euler(0, 0, 0),
        initialPosition: new THREE.Vector3(x, y, z)
      });
    }
  }
}

/**
 * Вспомогательная функция: переводит оси и направления в стандартную нотацию спидкубинга (U, D, R, L, F, B).
 * @param axis Ось вращения ('x', 'y' или 'z')
 * @param value Координата слоя (1, 0, -1)
 * @param dir Направление вращения (1 или -1)
 * @returns Строка с ходом (например, "U" или "R'")
 */
export function getMoveNotation(axis: 'x'|'y'|'z', value: number, dir: 1|-1): string {
  if (axis === 'y' && value === 1) return dir === -1 ? 'U' : "U'";
  if (axis === 'y' && value === -1) return dir === 1 ? 'D' : "D'";
  if (axis === 'x' && value === 1) return dir === -1 ? 'R' : "R'";
  if (axis === 'x' && value === -1) return dir === 1 ? 'L' : "L'";
  if (axis === 'z' && value === 1) return dir === -1 ? 'F' : "F'";
  if (axis === 'z' && value === -1) return dir === 1 ? 'B' : "B'";
  return '';
}

/**
 * Физически поворачивает один слой (грань) кубика на 90 градусов.
 * Использует кватернионы для избежания "шарнирного замка" (Gimbal Lock) и правильного пересчета поворотов.
 */
function applyRotation(cubies: Cubie[], axis: 'x'|'y'|'z', value: number, direction: 1|-1): Cubie[] {
  const angle = (Math.PI / 2) * direction; // 90 градусов в радианах
  
  // Создаем кватернион вращения вокруг нужной оси
  const quaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0),
    angle
  );

  return cubies.map(cubie => {
    // Если кубик принадлежит вращаемому слою
    if (Math.round(cubie.position[axis]) === value) {
      // 1. Поворачиваем позицию кубика относительно центра (0,0,0)
      const newPos = cubie.position.clone().applyQuaternion(quaternion);
      
      // 2. Обновляем локальное вращение самой детали (чтобы наклейки смотрели в нужную сторону)
      const currentQuat = new THREE.Quaternion().setFromEuler(cubie.rotation);
      const newQuat = quaternion.clone().multiply(currentQuat);
      const newEuler = new THREE.Euler().setFromQuaternion(newQuat);
      
      // Округляем позиции, чтобы избежать ошибок плавающей запятой (например, 0.99999 -> 1)
      newPos.x = Math.round(newPos.x);
      newPos.y = Math.round(newPos.y);
      newPos.z = Math.round(newPos.z);
      
      return { ...cubie, position: newPos, rotation: newEuler };
    }
    return cubie; // Остальные детали не трогаем
  });
}

// Глобальный стейт приложения (Хранилище Zustand)
interface CubeState {
  // Основные данные кубика
  cubies: Cubie[]; // Текущее состояние всех 26 деталей
  solveFormula: string[]; // Формула ходов для автоматической сборки (генерируется при скрембле)
  moveCount: number; // Счетчик ходов пользователя
  
  // Состояние анимации автоматических поворотов (от кнопок или автосборщика)
  isAnimating: boolean;
  animAxis: 'x' | 'y' | 'z' | null;
  animValue: number | null;
  animDir: 1 | -1 | null;
  animAngle: number;
  
  // Состояние физического перетаскивания граней мышью (Drag & Drop)
  isDragging: boolean;
  dragAxis: 'x' | 'y' | 'z' | null; // Ось, вокруг которой сейчас крутится грань
  dragValue: number | null; // Координата слоя (например, 1 для правой грани)
  dragAngle: number; // Текущий угол отклонения (тянется за мышкой)
  dragFace: 'x' | 'y' | 'z' | null; // По какой нормали пользователь кликнул
  dragSign: 1 | -1 | null; // С какой стороны кубика кликнули
  startPoint: THREE.Vector3 | null; // Точка старта клика в 3D пространстве
  dragCubiePos: THREE.Vector3 | null; // Позиция конкретной детали, за которую схватились

  // Методы управления
  isPaintMode: boolean;
  is2DPaintMode: boolean;
  setIs2DPaintMode: (val: boolean) => void;
  activePaintColor: 'U'|'R'|'F'|'D'|'L'|'B';
  paintColors: Record<string, 'U'|'R'|'F'|'D'|'L'|'B'>;
  togglePaintMode: () => void;
  setActivePaintColor: (color: 'U'|'R'|'F'|'D'|'L'|'B') => void;
  paintSticker: (cubieId: string, face: 'U'|'R'|'F'|'D'|'L'|'B') => void;
  solvePaintedCube: () => Promise<string | null>;

  startDrag: (faceAxis: 'x' | 'y' | 'z', faceSign: 1 | -1, cubiePos: THREE.Vector3, point: THREE.Vector3) => void;
  updateDrag3D: (currentPoint: THREE.Vector3) => void;
  endDrag: () => void;
  
  rotateLayer: (axis: 'x' | 'y' | 'z', value: number, direction: 1 | -1) => void;
  requestRotate: (axis: 'x' | 'y' | 'z', value: number, direction: 1 | -1) => void;
  rotateWholeCube: (axis: 'x' | 'y' | 'z', direction: 1 | -1) => void;
  setCubeFromSolveAlgorithm: (moves: string[]) => void;
  updateAnimation: (step: number) => void;
  
  scramble: () => void;
  reset: () => void;

  keyBindings: Record<'U'|'D'|'R'|'L'|'F'|'B', string>;
  setKeyBinding: (face: 'U'|'D'|'R'|'L'|'F'|'B', code: string) => void;
  resetKeyBindings: () => void;

  puzzleType: '3x3' | '2x2' | 'mirror' | 'pyraminx';
  setPuzzleType: (type: '3x3' | '2x2' | 'mirror' | 'pyraminx') => void;
}

export const useCubeStore = create<CubeState>()(
  persist(
    (set, get) => ({
      puzzleType: '3x3',
      setPuzzleType: (type) => {
        set({ puzzleType: type });
        get().reset();
      },
      cubies: INITIAL_CUBIES,
      solveFormula: [],
      moveCount: 0,
      
      keyBindings: {
        U: 'KeyU',
        D: 'KeyD',
        R: 'KeyR',
        L: 'KeyL',
        F: 'KeyF',
        B: 'KeyB'
      },
      setKeyBinding: (face, code) => set(state => ({
        keyBindings: { ...state.keyBindings, [face]: code }
      })),
      resetKeyBindings: () => set({
        keyBindings: {
          U: 'KeyU',
          D: 'KeyD',
          R: 'KeyR',
          L: 'KeyL',
          F: 'KeyF',
          B: 'KeyB'
        }
      }),
      
      isAnimating: false,
      animAxis: null,
      animValue: null,
      animDir: null,
      animAngle: 0,
      
      isDragging: false,
      dragAxis: null,
      dragValue: null,
      dragAngle: 0,
      dragFace: null,
      dragSign: null,
      startPoint: null,
      dragCubiePos: null,
      
      isPaintMode: false,
      is2DPaintMode: false,
      setIs2DPaintMode: (val) => set({ is2DPaintMode: val }),
      activePaintColor: 'U',
      paintColors: {},

      togglePaintMode: () => {
        const state = get();
        if (state.isPaintMode) {
          set({ isPaintMode: false });
        } else {
          // Инициализируем собранные цвета
          const initColors: Record<string, 'U'|'R'|'F'|'D'|'L'|'B'> = {};
          for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
              for (let z = -1; z <= 1; z++) {
                const id = `${x}-${y}-${z}`;
                if (y === 1) initColors[`${id}-U`] = 'U';
                if (y === -1) initColors[`${id}-D`] = 'D';
                if (x === 1) initColors[`${id}-R`] = 'R';
                if (x === -1) initColors[`${id}-L`] = 'L';
                if (z === 1) initColors[`${id}-F`] = 'F';
                if (z === -1) initColors[`${id}-B`] = 'B';
              }
            }
          }
          set({ 
            isPaintMode: true, 
            paintColors: initColors,
            // Сбрасываем кубик
            cubies: INITIAL_CUBIES.map(c => ({...c, position: c.position.clone(), rotation: new THREE.Euler(0,0,0)})),
            solveFormula: [],
            moveCount: 0,
          });
        }
      },

      setActivePaintColor: (color) => set({ activePaintColor: color }),
      
      paintSticker: (cubieId, face) => {
        const state = get();
        if (!state.isPaintMode) return;
        const parts = cubieId.split('-');
        const zeros = parts.filter(p => p === '0').length;
        if (zeros === 2) return; 
        
        set({
          paintColors: {
            ...state.paintColors,
            [`${cubieId}-${face}`]: state.activePaintColor
          }
        });
      },
      
      solvePaintedCube: async () => {
        const state = get();
        // Собираем строку для rubik-solver
        const colors = state.paintColors;
        let cubeStr = '';
        
        // Порядок: U R F D L B
        // Для каждой грани нужно отсортировать правильно!
        // U: z от -1 до 1, x от -1 до 1
        for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) cubeStr += colors[`${x}-1-${z}-U`];
        // R: y от 1 до -1, z от 1 до -1
        for (let y = 1; y >= -1; y--) for (let z = 1; z >= -1; z--) cubeStr += colors[`1-${y}-${z}-R`];
        // F: y от 1 до -1, x от -1 до 1
        for (let y = 1; y >= -1; y--) for (let x = -1; x <= 1; x++) cubeStr += colors[`${x}-${y}-1-F`];
        // D: z от 1 до -1, x от -1 до 1
        for (let z = 1; z >= -1; z--) for (let x = -1; x <= 1; x++) cubeStr += colors[`${x}--1-${z}-D`];
        // L: y от 1 до -1, z от -1 до 1
        for (let y = 1; y >= -1; y--) for (let z = -1; z <= 1; z++) cubeStr += colors[`-1-${y}-${z}-L`];
        // B: y от 1 до -1, x от 1 до -1
        for (let y = 1; y >= -1; y--) for (let x = 1; x >= -1; x--) cubeStr += colors[`${x}-${y}--1-B`];

        // Проверка, что каждого цвета ровно 9
        const colorCounts: Record<string, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
        for (const char of cubeStr) {
          if (colorCounts[char] !== undefined) {
            colorCounts[char]++;
          }
        }
        
        const colorNames: Record<string, string> = {
          U: 'желтого (U)',
          R: 'красного (R)',
          F: 'зеленого (F)',
          D: 'белого (D)',
          L: 'оранжевого (L)',
          B: 'синего (B)'
        };
        
        for (const [col, count] of Object.entries(colorCounts)) {
          if (count !== 9) {
            return `Ошибка: Цветов должно быть по 9 каждого. Найдено ${count} для ${colorNames[col]} цвета.`;
          }
        }

        try {
          const solver = await import('rubik-solver');
          solver.initSolver();
          let cubeObj = solver.Cube.fromString(cubeStr);
          
          
          let isValid = cubeObj.verify();
          
          if (typeof isValid === 'string' && isValid.includes('Parity error (2 edges or 2 corners need swapping)') && state.puzzleType === '2x2') {
             // Swap UF and UR edges in cubeStr
             const arr = cubeStr.split('');
             const tempU = arr[7]; arr[7] = arr[5]; arr[5] = tempU;
             const tempFR = arr[19]; arr[19] = arr[10]; arr[10] = tempFR;
             cubeStr = arr.join('');
             const newCubeObj = solver.Cube.fromString(cubeStr);
             isValid = newCubeObj.verify();
             if (isValid === true) {
                // Parity fixed!
                cubeObj = solver.Cube.fromString(cubeStr);
             }
          }

          if (isValid !== true) {
             let errorMsg = isValid;
             if (isValid === 'Invalid cube: Duplicate edge detected.') errorMsg = 'Найдено дублирующееся ребро (возможно, вы закрасили два ребра одинаково)';
             else if (isValid === 'Invalid cube: Duplicate corner detected.') errorMsg = 'Найден дублирующийся угол (два угла раскрашены одинаково)';
             else if (isValid === 'Invalid cube: Duplicate center detected.') errorMsg = 'Найден дублирующийся центр';
             else if (typeof isValid === 'string' && isValid.includes('Edge flip error')) errorMsg = 'Одно из ребер перевернуто (физически невозможно в правильном кубике)';
             else if (typeof isValid === 'string' && isValid.includes('Corner twist error')) errorMsg = 'Один из углов повернут неверно (физически невозможно)';
             else if (typeof isValid === 'string' && isValid.includes('Parity error (2 edges or 2 corners need swapping)')) errorMsg = 'Ошибка четности (невозможно поменять местами только два элемента)';
             else if (typeof isValid === 'string' && isValid.includes('Invalid cube:')) errorMsg = 'Сборка невозможна. Проверьте правильность узора!';
             
             return "Невозможно собрать: " + errorMsg;
          }

          // Kociemba's algorithm (rubik-solver) has a known bug where it generates 14-20 move sequences
          // for trivial 1-4 move scrambles (it doesn't check early depths properly).
          // We run a fast BFS for up to depth 4 to instantly solve short scrambles optimally.
                    solver.initSolver();
          const solveShort = (c: any, maxD: number = 4) => {
            const checkSolved = state.puzzleType === '2x2' 
              ? (cube: any) => {
                  const f = cube.asString();
                  const cornerIndices = [
                    [0, 2, 6, 8],     // U
                    [9, 11, 15, 17],  // R
                    [18, 20, 24, 26], // F
                    [27, 29, 33, 35], // D
                    [36, 38, 42, 44], // L
                    [45, 47, 51, 53]  // B
                  ];
                  for (const face of cornerIndices) {
                    const firstColor = f[face[0]];
                    for (let i = 1; i < 4; i++) {
                      if (f[face[i]] !== firstColor) return false;
                    }
                  }
                  return true;
                }
              : (cube: any) => cube.isSolved();

            if (checkSolved(c)) return "";
            const MOVES = ["U", "U'", "U2", "D", "D'", "D2", "R", "R'", "R2", "L", "L'", "L2", "F", "F'", "F2", "B", "B'", "B2"];
            let queue = [{ c: c, path: [] as string[] }];
            for (let d = 1; d <= maxD; d++) {
              const nextQueue = [];
              for (const item of queue) {
                for (const m of MOVES) {
                  if (item.path.length > 0 && item.path[item.path.length - 1][0] === m[0]) continue;
                  
                  const nextC = item.c.clone();
                  nextC.move(m);
                  if (checkSolved(nextC)) {
                    return [...item.path, m].join(" ");
                  }
                  nextQueue.push({ c: nextC, path: [...item.path, m] });
                }
              }
              queue = nextQueue;
            }
            return null;
          };

          let solutionStr = solveShort(cubeObj, 4);
          
          if (solutionStr === null) {
            solutionStr = solver.solve(cubeObj);
          }
          
          if (!solutionStr && solutionStr !== "") {
            return "Не удалось найти решение. Возможно кубик собран неверно.";
          }
          
          // В случае если solver выдает странный префикс для решенного кубика (баг Kociemba identity)
          if (solutionStr.startsWith("R L U2 R L F2 R2 U2 R2 F2 R2 U2 F2 L2")) {
            solutionStr = solutionStr.replace("R L U2 R L F2 R2 U2 R2 F2 R2 U2 F2 L2", "").trim();
          }

          if (solutionStr === "") {
             return "Кубик уже собран!";
          }
          
          state.setCubeFromSolveAlgorithm(solutionStr.split(' '));
          set({ isPaintMode: false });
          return null; // success
        } catch (err: any) {
          return "Системная ошибка решения. Проверьте правильность раскраски!";
        }
      },

      reset: () => set({ 
        cubies: INITIAL_CUBIES.map(c => ({...c, position: c.position.clone(), rotation: new THREE.Euler(0,0,0)})),
        solveFormula: [],
        moveCount: 0,
        isAnimating: false, animAxis: null, animValue: null, animDir: null, animAngle: 0,
        isDragging: false, dragAxis: null, dragValue: null, dragAngle: 0, startPoint: null, dragCubiePos: null
      }),

      scramble: () => {
        if (get().isAnimating || get().isDragging) return;
        const axes: ('x'|'y'|'z')[] = ['x', 'y', 'z'];
        const values = [-1, 1];
        const dirs: (1|-1)[] = [1, -1];
        const sequence: { axis: 'x'|'y'|'z', value: number, dir: 1|-1, isDouble: boolean }[] = [];
        
        let tempCubies = get().cubies;
        let lastAxis = null;
        
        for(let i = 0; i < 20; i++) {
           let axis = axes[Math.floor(Math.random() * axes.length)];
           while(axis === lastAxis) axis = axes[Math.floor(Math.random() * axes.length)];
           lastAxis = axis;
           
           const value = values[Math.floor(Math.random() * values.length)];
           const dir = dirs[Math.floor(Math.random() * dirs.length)];
           const isDouble = Math.random() > 0.6; // 40% шанс на двойной ход
           
           sequence.push({ axis, value, dir, isDouble });
           tempCubies = applyRotation(tempCubies, axis, value, dir);
           if (isDouble) {
             tempCubies = applyRotation(tempCubies, axis, value, dir);
           }
        }
        
        const solveSeq = sequence.reverse().map(m => {
           const baseMove = getMoveNotation(m.axis, m.value, (m.dir * -1) as 1|-1);
           if (m.isDouble) {
              return baseMove[0] + '2';
           }
           return baseMove;
        });
        
        set({ cubies: tempCubies, solveFormula: solveSeq, moveCount: 0 });
      },

      startDrag: (faceAxis, faceSign, cubiePos, point) => {
        const state = get();
        if (state.isAnimating || state.isDragging) return;
        set({
          isDragging: true,
          dragFace: faceAxis,
          dragSign: faceSign,
          dragCubiePos: cubiePos,
          startPoint: point,
          dragAxis: null,
          dragAngle: 0,
          dragValue: null
        });
      },

      updateDrag3D: (currentPoint) => {
        const state = get();
        if (!state.isDragging || !state.startPoint || !state.dragCubiePos) return;

        const delta = currentPoint.clone().sub(state.startPoint);
        let axis = state.dragAxis;
        let value = state.dragValue;
        
        if (!axis) {
          if (delta.length() > 0.15) { 
            if (state.dragFace === 'z') {
              axis = Math.abs(delta.x) > Math.abs(delta.y) ? 'y' : 'x';
            } else if (state.dragFace === 'x') {
              axis = Math.abs(delta.z) > Math.abs(delta.y) ? 'y' : 'z';
            } else if (state.dragFace === 'y') {
              axis = Math.abs(delta.x) > Math.abs(delta.z) ? 'z' : 'x';
            }
            if (!axis) return;
            value = Math.round((state.dragCubiePos as any)[axis]);
            set({ dragAxis: axis, dragValue: value });
          } else {
            return; 
          }
        }

        const rotateVector = new THREE.Vector3(axis === 'x'?1:0, axis === 'y'?1:0, axis === 'z'?1:0);
        const expectedDelta = rotateVector.clone().cross(state.startPoint).normalize();
        const dragDist = delta.dot(expectedDelta);
        
        const sensitivity = 0.8; 
        let angle = dragDist * sensitivity;
        
        if (angle > Math.PI / 1.5) angle = Math.PI / 1.5;
        if (angle < -Math.PI / 1.5) angle = -Math.PI / 1.5;

        set({ dragAngle: angle });
      },

      endDrag: () => {
        const state = get();
        if (!state.isDragging) return;

        const axis = state.dragAxis;
        const value = state.dragValue;
        const angle = state.dragAngle;

        set({
          isDragging: false,
          dragAxis: null,
          dragValue: null,
          dragAngle: 0,
          dragFace: null,
          dragSign: null
        });

        if (axis && value !== null) {
          if (Math.abs(angle) > Math.PI / 8) {
            const dir = angle > 0 ? 1 : -1;
            set({
              isAnimating: true,
              animAxis: axis,
              animValue: value,
              animDir: dir as 1 | -1,
              animAngle: angle
            });
          }
        }
      },

      requestRotate: (axis, value, direction) => {
        const state = get();
        if (state.isAnimating || state.isDragging) return; 
        
        set({
          isAnimating: true,
          animAxis: axis,
          animValue: value,
          animDir: direction,
          animAngle: 0
        });
      },

      rotateWholeCube: (axis, direction) => {
        if (get().isAnimating || get().isDragging) return;
        
        // Поворачиваем каждый из 3 слоев вдоль оси
        let newCubies = get().cubies;
        newCubies = applyRotation(newCubies, axis, -1, direction);
        newCubies = applyRotation(newCubies, axis, 0, direction);
        newCubies = applyRotation(newCubies, axis, 1, direction);
        
        set({ cubies: newCubies });
      },

      setCubeFromSolveAlgorithm: (moves: string[]) => {
        if (get().isAnimating || get().isDragging) return;
        
        let tempCubies = INITIAL_CUBIES.map(c => ({...c, position: c.position.clone(), rotation: new THREE.Euler(0,0,0)}));
        
        const axisMap: Record<string, 'x'|'y'|'z'> = { R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' };
        const valMap: Record<string, number> = { U: 1, D: -1, R: 1, L: -1, F: 1, B: -1 };
        
        // Функция инвертирования хода
        const reverseMove = (move: string) => {
          if (move.endsWith("2")) return move; // двойной ход остается двойным
          if (move.endsWith("'")) return move[0];
          return move + "'";
        };

        // Разворачиваем список ходов и инвертируем их
        const scrambleMoves = [...moves].reverse().map(reverseMove);

        for (const move of scrambleMoves) {
          const base = move[0];
          const isPrime = move.includes("'");
          const isDouble = move.includes("2");
          
          let dir: 1|-1 = 1;
          if (base === 'U' || base === 'R' || base === 'F') {
            dir = isPrime ? 1 : -1;
          } else {
            dir = isPrime ? -1 : 1;
          }
          
          const axis = axisMap[base];
          const val = valMap[base];
          
          tempCubies = applyRotation(tempCubies, axis, val, dir);
          if (isDouble) {
            tempCubies = applyRotation(tempCubies, axis, val, dir);
          }
        }
        
        set({ 
          cubies: tempCubies, 
          solveFormula: moves, 
          moveCount: 0,
          isAnimating: false,
          isDragging: false
        });
      },

      updateAnimation: (step) => {
        const state = get();
        if (!state.isAnimating || !state.animDir || !state.animAxis || state.animValue === null) return;
        
        const targetAngle = (Math.PI / 2) * state.animDir;
        let nextAngle = state.animAngle + (step * state.animDir);
        let finished = false;

        if ((state.animDir > 0 && nextAngle >= targetAngle) || (state.animDir < 0 && nextAngle <= targetAngle)) {
          nextAngle = targetAngle;
          finished = true;
        }

        if (finished) {
          get().rotateLayer(state.animAxis, state.animValue, state.animDir);
        } else {
          set({ animAngle: nextAngle });
        }
      },

      rotateLayer: (axis, value, direction) => set((state) => {
        const newCubies = applyRotation(state.cubies, axis, value, direction);
        
        let newFormula = [...state.solveFormula];
        if (newFormula.length > 0) {
          const expectedMove = newFormula[0];
          const axisMap: Record<string, 'x'|'y'|'z'> = { R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' };
          const valMap: Record<string, number> = { U: 1, D: -1, R: 1, L: -1, F: 1, B: -1 };
          
          const baseMove = expectedMove[0];
          const isPrime = expectedMove.includes("'");
          const isDouble = expectedMove.includes("2");
          
          let expectedDir: 1 | -1 = 1;
          if (baseMove === 'U' || baseMove === 'R' || baseMove === 'F') {
            expectedDir = isPrime ? 1 : -1;
          } else {
            expectedDir = isPrime ? -1 : 1;
          }

          if (axis === axisMap[baseMove] && value === valMap[baseMove] && direction === expectedDir) {
            if (isDouble) {
              // Если это двойной ход (U2), превращаем его в одинарный (U) для следующего шага
              newFormula[0] = baseMove;
            } else {
              newFormula.shift();
            }
          } else {
            // Если пользователь сделал неправильный ход, сбрасываем формулу
            newFormula = [];
          }
        }

        return { 
          cubies: newCubies,
          solveFormula: newFormula,
          moveCount: state.moveCount + 1,
          isAnimating: false,
          animAxis: null,
          animValue: null,
          animDir: null,
          animAngle: 0
        };
      }),
    }),
    {
      name: 'rubiks-cube-storage', // Ключ в localStorage
      // Выбираем, какие данные сохранять при перезагрузке страницы
      partialize: (state) => ({ 
        cubies: state.cubies, 
        solveFormula: state.solveFormula,
        moveCount: state.moveCount 
      }),
      // Функция восстановления данных из JSON (очень важно для Three.js!)
      // JSON превращает классы (Vector3, Euler) в простые объекты. Здесь мы их восстанавливаем.
      merge: (persistedState: any, currentState) => {
        if (!persistedState || !persistedState.cubies) return { ...currentState, ...persistedState };
        
        const restoredCubies = persistedState.cubies.map((c: any) => ({
          ...c,
          position: new THREE.Vector3(c.position.x, c.position.y, c.position.z),
          rotation: new THREE.Euler(
            c.rotation._x ?? c.rotation.x ?? 0, 
            c.rotation._y ?? c.rotation.y ?? 0, 
            c.rotation._z ?? c.rotation.z ?? 0, 
            c.rotation._order ?? c.rotation.order ?? 'XYZ'
          ),
          initialPosition: new THREE.Vector3(c.initialPosition.x, c.initialPosition.y, c.initialPosition.z),
        }));
        
        return {
          ...currentState,
          ...persistedState,
          cubies: restoredCubies,
          // Сбрасываем временные состояния анимации при загрузке страницы, чтобы кубик не застрял
          isAnimating: false,
          isDragging: false,
        };
      }
    }
  )
);

