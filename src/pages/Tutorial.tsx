import { useState } from 'react';
import { AlgorithmModal } from '../components/AlgorithmViewer';
import { motion } from 'framer-motion';

const colorMap: Record<string, string> = {
  W: '#FFFFFF',
  Y: '#F2D11F',
  R: '#D12A2A',
  B: '#1B5FE3',
  O: '#E86B0C',
  G: '#199B35',
  X: '#555555' // grey for unsolved
};

export function CubeIcon({ U, F, R, type = '3x3' }: { U: string, F: string, R: string, type?: string }) {
  if (type === 'pyraminx') {
    const polys = [
      "0,0 20,34.64 -20,34.64", 
      "-20,34.64 0,69.28 -40,69.28", 
      "20,34.64 40,69.28 0,69.28", 
      "-20,34.64 20,34.64 0,69.28", 
      "-40,69.28 -20,103.92 -60,103.92", 
      "0,69.28 20,103.92 -20,103.92", 
      "40,69.28 60,103.92 20,103.92", 
      "-40,69.28 0,69.28 -20,103.92", 
      "0,69.28 40,69.28 20,103.92", 
    ];
    return (
      <svg viewBox="-65 -5 130 115" className="drop-shadow-xl" style={{ width: '80%', height: 'auto', maxWidth: 200 }}>
        <g>
          {F.split('').slice(0, 9).map((c, i) => (
            <polygon key={i} points={polys[i]} fill={colorMap[c] || colorMap.X} stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="round" />
          ))}
        </g>
      </svg>
    );
  }

  const is2x2 = type === '2x2';
  const size = is2x2 ? 2 : 3;
  const dx = 17.32;
  const dy = 10;

  // Mirror icon: flat cube, no position offsets - use shading to show solved/scrambled
  const getMirrorOffset = (_face: string, _r: number, _c: number, _char: string) => ({ x: 0, y: 0 });

  const getTopTile = (r: number, c: number, ch: string) => {
    const ox = is2x2 ? dx : 0;
    const oy = is2x2 ? -dy : 0;
    const mo = getMirrorOffset('U', r, c, ch);
    const x = c * dx - r * dx + ox + mo.x;
    const y = c * dy + r * dy + 4 + oy + mo.y;
    return `${x},${y} ${x+dx},${y+dy} ${x},${y+2*dy} ${x-dx},${y+dy}`;
  };

  const getFrontTile = (r: number, c: number, ch: string) => {
    const ox = is2x2 ? dx : 0;
    const oy = is2x2 ? -dy : 0;
    const mo = getMirrorOffset('F', r, c, ch);
    const x = -size * dx + c * dx + ox + mo.x;
    const y = size * dy + c * dy + r * (2 * dy) + 4 + oy + mo.y;
    return `${x},${y} ${x+dx},${y+dy} ${x+dx},${y+dy+2*dy} ${x},${y+2*dy}`;
  };

  const getRightTile = (r: number, c: number, ch: string) => {
    const ox = is2x2 ? dx : 0;
    const oy = is2x2 ? -dy : 0;
    const mo = getMirrorOffset('R', r, c, ch);
    const x = c * dx + ox + mo.x;
    const y = size * 2 * dy - c * dy + r * (2 * dy) + 4 + oy + mo.y;
    return `${x},${y} ${x+dx},${y-dy} ${x+dx},${y-dy+2*dy} ${x},${y+2*dy}`;
  };

  const renderFace = (colors: string, getPolygon: (r: number, c: number, ch: string) => string) => {
    const indices = is2x2 ? [0, 2, 6, 8] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    return indices.map((idx, i) => {
      const ch = colors[idx] || 'X';
      const row = Math.floor(i / size);
      const col = i % size;
      let fill: string;
      if (type === 'mirror') {
        // S=solved(bright white), X=scrambled(dark)
        // Use gradient of grays to show how much is assembled
        if (ch === 'S') fill = '#e0e0e0';        // solved = bright silver
        else if (ch === 'T') fill = '#a0a0a0';   // tall = medium
        else if (ch === 'D') fill = '#585858';   // short = darker
        else fill = '#383838';                    // scrambled = very dark
      } else {
        fill = colorMap[ch] || colorMap.X;
      }
      return (
        <polygon key={i} points={getPolygon(row, col, ch)} fill={fill}
          stroke={type === 'mirror' ? (ch === 'S' ? '#999' : '#222') : '#1a1a1a'}
          strokeWidth={type === 'mirror' ? (ch === 'S' ? '1.5' : '2.5') : '3'}
          strokeLinejoin="round" />
      );
    });
  };

  // 3x3: spans x=-52..+52, y=4..124; 2x2(ox=17.32,oy=-10): spans x=-17..+52, y=-6..74
  const viewBox = is2x2 ? '-25 -15 90 100' : '-62 -5 124 140';

  return (
    <svg viewBox={viewBox} className="drop-shadow-xl" style={{ width: '80%', height: 'auto', maxWidth: 210 }}>
      <g>
        {renderFace(U, getTopTile)}
        {renderFace(F, getFrontTile)}
        {renderFace(R, getRightTile)}
      </g>
    </svg>
  );
}

export function MirrorCubeIcon({ F, U, R }: { F: string; U: string; R: string }) {
  const fCh = [...F.padEnd(9,'X')].slice(0,9);
  const uCh = [...U.padEnd(9,'X')].slice(0,9);
  const rCh = [...R.padEnd(9,'X')].slice(0,9);

  // Colors based on solved (S) or scrambled (X)
  const fFill = (ch: string) => ch === 'S' ? '#cbd5e1' : '#334155';
  const rFill = (ch: string) => ch === 'S' ? '#94a3b8' : '#1e293b';
  const uFill = (ch: string) => ch === 'S' ? '#f8fafc' : '#475569';
  const stk   = (ch: string) => ch === 'S' ? '#64748b' : '#0f172a';
  const sw    = (ch: string) => ch === 'S' ? '1'       : '1.5';

  const DX = 51.96;
  const DY = 30;
  const HZ = 60;
  const OFFSET_Y = 4;

  const proj = (x: number, y: number, z: number) => {
    const sx = (x - z) * DX;
    const sy = (x + z) * DY + y * HZ + OFFSET_Y;
    return `${sx.toFixed(1)},${sy.toFixed(1)}`;
  };

  // Asymmetric cut proportions for Mirror Blocks
  const xCuts = [0.0, 0.25, 0.65, 1.0];
  const yCuts = [0.0, 0.35, 0.75, 1.0];
  const zCuts = [0.0, 0.40, 0.70, 1.0];

  const polys: React.ReactElement[] = [];

  // 1) TOP FACE
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const ch = uCh[r * 3 + c];
      const x1 = xCuts[c], x2 = xCuts[c + 1];
      const z1 = zCuts[r], z2 = zCuts[r + 1];
      const pts = `${proj(x1, 0, z1)} ${proj(x2, 0, z1)} ${proj(x2, 0, z2)} ${proj(x1, 0, z2)}`;
      polys.push(<polygon key={`u${r}${c}`} points={pts}
        fill={uFill(ch)} stroke={stk(ch)} strokeWidth={sw(ch)} strokeLinejoin="round"/>);
    }
  }

  // 2) RIGHT FACE
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const ch = rCh[r * 3 + c];
      const z_idx = 2 - c;
      const z1 = zCuts[z_idx], z2 = zCuts[z_idx + 1];
      const y1 = yCuts[r], y2 = yCuts[r + 1];
      const pts = `${proj(1, y1, z2)} ${proj(1, y1, z1)} ${proj(1, y2, z1)} ${proj(1, y2, z2)}`;
      polys.push(<polygon key={`r${r}${c}`} points={pts}
        fill={rFill(ch)} stroke={stk(ch)} strokeWidth={sw(ch)} strokeLinejoin="round"/>);
    }
  }

  // 3) FRONT FACE
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const ch = fCh[r * 3 + c];
      const x1 = xCuts[c], x2 = xCuts[c + 1];
      const y1 = yCuts[r], y2 = yCuts[r + 1];
      const pts = `${proj(x1, y1, 1)} ${proj(x2, y1, 1)} ${proj(x2, y2, 1)} ${proj(x1, y2, 1)}`;
      polys.push(<polygon key={`f${r}${c}`} points={pts}
        fill={fFill(ch)} stroke={stk(ch)} strokeWidth={sw(ch)} strokeLinejoin="round"/>);
    }
  }

  return (
    <svg viewBox="-62 -5 124 140" className="drop-shadow-xl"
      style={{ width: '80%', height: 'auto', maxWidth: 210 }}>
      <g>{polys}</g>
    </svg>
  );
}

export function Tutorial() {
  const [activePuzzle, setActivePuzzle] = useState<'3x3'|'2x2'|'mirror'|'pyraminx'>('3x3');
  const [activeAlgo, setActiveAlgo] = useState<{formula: string, step: number, name: string, puzzleType?: string, preScramble?: string} | null>(null);

  const tutorialData: Record<string, { notation: any[], steps: any[] }> = {
    '3x3': {
      notation: [
        { move: "R", desc: "\u041F\u0440\u0430\u0432\u0430\u044F \u043E\u0442 \u0441\u0435\u0431\u044F (\u0432\u0432\u0435\u0440\u0445)", icon: "\u2191" },
        { move: "R'", desc: "\u041F\u0440\u0430\u0432\u0430\u044F \u043D\u0430 \u0441\u0435\u0431\u044F (\u0432\u043D\u0438\u0437)", icon: "\u2193" },
        { move: "L", desc: "\u041B\u0435\u0432\u0430\u044F \u043D\u0430 \u0441\u0435\u0431\u044F (\u0432\u043D\u0438\u0437)", icon: "\u2193" },
        { move: "L'", desc: "\u041B\u0435\u0432\u0430\u044F \u043E\u0442 \u0441\u0435\u0431\u044F (\u0432\u0432\u0435\u0440\u0445)", icon: "\u2191" },
        { move: "U", desc: "\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u0432\u043B\u0435\u0432\u043E (\u043F\u043E \u0447\u0430\u0441\u043E\u0432\u043E\u0439)", icon: "\u2190" },
        { move: "U'", desc: "\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u0432\u043F\u0440\u0430\u0432\u043E (\u043F\u0440\u043E\u0442\u0438\u0432)", icon: "\u2192" },
        { move: "F", desc: "\u0424\u0430\u0441\u0430\u0434 \u043F\u043E \u0447\u0430\u0441\u043E\u0432\u043E\u0439", icon: "\u21BB" },
        { move: "F'", desc: "\u0424\u0430\u0441\u0430\u0434 \u043F\u0440\u043E\u0442\u0438\u0432 \u0447\u0430\u0441\u043E\u0432\u043E\u0439", icon: "\u21BA" },
      ],
      steps: [
        {
          title: "\u042D\u0442\u0430\u043F 1: \u041F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u044B\u0439 \u0431\u0435\u043B\u044B\u0439 \u043A\u0440\u0435\u0441\u0442",
          desc: "\u0421\u043E\u0431\u0435\u0440\u0438\u0442\u0435 \u0431\u0435\u043B\u044B\u0439 \u043A\u0440\u0435\u0441\u0442 \u0432\u043E\u043A\u0440\u0443\u0433 \u0431\u0435\u043B\u043E\u0433\u043E \u0446\u0435\u043D\u0442\u0440\u0430. \u0412\u0442\u043E\u0440\u044B\u0435 \u0446\u0432\u0435\u0442\u0430 \u044D\u0442\u0438\u0445 \u0440\u0435\u0431\u0435\u0440 \u0434\u043E\u043B\u0436\u043D\u044B \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0442\u044C \u0441 \u0446\u0435\u043D\u0442\u0440\u0430\u043C\u0438 \u0431\u043E\u043A\u043E\u0432\u044B\u0445 \u0433\u0440\u0430\u043D\u0435\u0439.",
          cube: { U: "XWXWWWXWX", F: "XGXXGXXXX", R: "XRXXRXXXX" },
          algos: []
        },
        {
          title: "\u042D\u0442\u0430\u043F 2: \u041F\u0435\u0440\u0432\u044B\u0439 \u0441\u043B\u043E\u0439 (\u0423\u0433\u043B\u044B)",
          desc: "\u041F\u043E\u0434\u0432\u0435\u0434\u0438\u0442\u0435 \u0431\u0435\u043B\u044B\u0439 \u0443\u0433\u043E\u043B \u0442\u0430\u043A, \u0447\u0442\u043E\u0431\u044B \u043E\u043D \u0431\u044B\u043B \u043C\u0435\u0436\u0434\u0443 \u0441\u0432\u043E\u0438\u043C\u0438 \u0446\u0435\u043D\u0442\u0440\u0430\u043C\u0438. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C \u00AB\u041F\u0438\u0444-\u041F\u0430\u0444\u00BB. \u041F\u043E\u0432\u0442\u043E\u0440\u044F\u0439\u0442\u0435 \u0435\u0433\u043E, \u043F\u043E\u043A\u0430 \u0443\u0433\u043E\u043B \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u0435\u0442 \u043D\u0430 \u043C\u0435\u0441\u0442\u043E.",
          cube: { U: "XXXXXXXXX", F: "XXXXXXGGG", R: "XXXXXXRRR" },
          algos: [{ name: "\u041F\u0438\u0444-\u041F\u0430\u0444", formula: "R U R' U'" }]
        },
        {
          title: "\u042D\u0442\u0430\u043F 3: \u0412\u0442\u043E\u0440\u043E\u0439 \u0441\u043B\u043E\u0439 (\u0420\u0435\u0431\u0440\u0430)",
          desc: "\u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0440\u0435\u0431\u0440\u043E \u0431\u0435\u0437 \u0436\u0435\u043B\u0442\u043E\u0433\u043E \u0446\u0432\u0435\u0442\u0430 \u043D\u0430 \u0432\u0435\u0440\u0445\u043D\u0435\u043C \u0441\u043B\u043E\u0435. \u041F\u043E\u0434\u0432\u0435\u0434\u0438\u0442\u0435 \u0435\u0433\u043E \u043A \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0449\u0435\u043C\u0443 \u0446\u0435\u043D\u0442\u0440\u0443. \u0412 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0438 \u043E\u0442 \u0442\u043E\u0433\u043E, \u043A\u0443\u0434\u0430 \u0435\u0433\u043E \u043D\u0443\u0436\u043D\u043E \u043F\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043E\u0434\u0438\u043D \u0438\u0437 \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C\u043E\u0432.",
          cube: { U: "XXXXXXXXX", F: "XXXGGGGGG", R: "XXXRRRRRR" },
          algos: [
            { name: "\u041D\u0430\u043F\u0440\u0430\u0432\u043E", formula: "U R U' R' U' F' U F" },
            { name: "\u041D\u0430\u043B\u0435\u0432\u043E", formula: "U' L' U L U F U' F'" }
          ]
        },
        {
          title: "\u042D\u0442\u0430\u043F 4: \u0416\u0435\u043B\u0442\u044B\u0439 \u043A\u0440\u0435\u0441\u0442",
          desc: "\u0421\u043E\u0431\u0435\u0440\u0438\u0442\u0435 \u0436\u0435\u043B\u0442\u044B\u0439 \u043A\u0440\u0435\u0441\u0442 \u043D\u0430 \u0432\u0435\u0440\u0445\u043D\u0435\u0439 \u0433\u0440\u0430\u043D\u0438.",
          cube: { U: "XYXYYYXYX", F: "XXXGGGGGG", R: "XXXRRRRRR" },
          algos: [{ name: "\u041F\u0430\u043B\u043A\u0430 / \u0413\u0430\u043B\u043A\u0430", formula: "F R U R' U' F'" }]
        },
        {
          title: "\u042D\u0442\u0430\u043F 5: \u041F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u044B\u0439 \u0436\u0435\u043B\u0442\u044B\u0439 \u043A\u0440\u0435\u0441\u0442",
          desc: "\u0421\u0434\u0435\u043B\u0430\u0439\u0442\u0435 \u0442\u0430\u043A, \u0447\u0442\u043E\u0431\u044B \u0431\u043E\u043A\u043E\u0432\u044B\u0435 \u0446\u0432\u0435\u0442\u0430 \u0436\u0435\u043B\u0442\u043E\u0433\u043E \u043A\u0440\u0435\u0441\u0442\u0430 \u0441\u043E\u0432\u043F\u0430\u043B\u0438 \u0441 \u0446\u0435\u043D\u0442\u0440\u0430\u043C\u0438.",
          cube: { U: "XYXYYYXYX", F: "XGXGGGGGG", R: "XRXRRRRRR" },
          algos: [{ name: "\u0420\u044B\u0431\u043A\u0430", formula: "R U R' U R U2 R'" }]
        },
        {
          title: "\u042D\u0442\u0430\u043F 6: \u0416\u0435\u043B\u0442\u044B\u0435 \u0443\u0433\u043B\u044B \u043D\u0430 \u0441\u0432\u043E\u0438 \u043C\u0435\u0441\u0442\u0430",
          desc: "\u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0443\u0433\u043E\u043B, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u0441\u0442\u043E\u0438\u0442 \u043C\u0435\u0436\u0434\u0443 \u0441\u0432\u043E\u0438\u043C\u0438 \u0446\u0432\u0435\u0442\u0430\u043C\u0438. \u041F\u043E\u043C\u0435\u0441\u0442\u0438\u0442\u0435 \u0435\u0433\u043E \u0441\u043F\u0440\u0430\u0432\u0430 \u0441\u043F\u0435\u0440\u0435\u0434\u0438 \u0441\u0432\u0435\u0440\u0445\u0443. \u041F\u0440\u0438\u043C\u0435\u043D\u044F\u0439\u0442\u0435 \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C, \u043F\u043E\u043A\u0430 \u0432\u0441\u0435 \u0443\u0433\u043B\u044B \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u0443\u0442 \u043D\u0430 \u0441\u0432\u043E\u0438 \u043C\u0435\u0441\u0442\u0430.",
          cube: { U: "YYYYYYYYY", F: "XXXGGGGGG", R: "XXXRRRRRR" },
          algos: [{ name: "\u041F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430", formula: "U R U' L' U R' U' L" }]
        },
        {
          title: "\u042D\u0442\u0430\u043F 7: \u0420\u0430\u0437\u0432\u043E\u0440\u043E\u0442 \u0436\u0435\u043B\u0442\u044B\u0445 \u0443\u0433\u043B\u043E\u0432",
          desc: "\u041F\u0435\u0440\u0435\u0432\u0435\u0440\u043D\u0438\u0442\u0435 \u043A\u0443\u0431\u0438\u043A \u0431\u0435\u043B\u043E\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u043E\u0439 \u0412\u0412\u0415\u0420\u0425. \u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043D\u0435\u0440\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u043E\u0433\u043E \u0436\u0435\u043B\u0442\u043E\u0433\u043E \u0443\u0433\u043B\u0430 \u0434\u0435\u043B\u0430\u0439\u0442\u0435 \u00AB\u041F\u0438\u0444-\u041F\u0430\u0444\u00BB. \u0417\u0430\u0442\u0435\u043C \u043F\u043E\u043A\u0440\u0443\u0442\u0438\u0442\u0435 \u041D\u0418\u0416\u041D\u042E\u042E \u0433\u0440\u0430\u043D\u044C (D), \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0443\u0433\u043E\u043B.",
          cube: { U: "WWWWWWWWW", F: "GGGGGGGGG", R: "RRRRRRRRR" },
          algos: [{ name: "\u0420\u0430\u0437\u0432\u043E\u0440\u043E\u0442", formula: "R U R' U'" }]
        }
      ]
    },
    '2x2': {
      notation: [
        { move: "R", desc: "\u041F\u0440\u0430\u0432\u0430\u044F \u043E\u0442 \u0441\u0435\u0431\u044F (\u0432\u0432\u0435\u0440\u0445)", icon: "\u2191" },
        { move: "R'", desc: "\u041F\u0440\u0430\u0432\u0430\u044F \u043D\u0430 \u0441\u0435\u0431\u044F (\u0432\u043D\u0438\u0437)", icon: "\u2193" },
        { move: "U", desc: "\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u0432\u043B\u0435\u0432\u043E (\u043F\u043E \u0447\u0430\u0441\u043E\u0432\u043E\u0439)", icon: "\u2190" },
        { move: "U'", desc: "\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u0432\u043F\u0440\u0430\u0432\u043E (\u043F\u0440\u043E\u0442\u0438\u0432)", icon: "\u2192" },
        { move: "L", desc: "\u041B\u0435\u0432\u0430\u044F \u043D\u0430 \u0441\u0435\u0431\u044F (\u0432\u043D\u0438\u0437)", icon: "\u2193" },
        { move: "L'", desc: "\u041B\u0435\u0432\u0430\u044F \u043E\u0442 \u0441\u0435\u0431\u044F (\u0432\u0432\u0435\u0440\u0445)", icon: "\u2191" },
      ],
      steps: [
        {
          title: "\u042D\u0442\u0430\u043F 1: \u041F\u0435\u0440\u0432\u044B\u0439 \u0441\u043B\u043E\u0439",
          desc: "\u041F\u043E\u0441\u043A\u043E\u043B\u044C\u043A\u0443 \u0446\u0435\u043D\u0442\u0440\u043E\u0432 \u043D\u0435\u0442, \u043F\u0440\u043E\u0441\u0442\u043E \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043B\u044E\u0431\u043E\u0439 \u0443\u0433\u043E\u043B \u0441 \u0431\u0435\u043B\u044B\u043C \u0446\u0432\u0435\u0442\u043E\u043C \u0438 \u0441\u043E\u0431\u0438\u0440\u0430\u0439\u0442\u0435 \u043F\u0435\u0440\u0432\u044B\u0439 \u0441\u043B\u043E\u0439 \u0432\u043E\u043A\u0440\u0443\u0433 \u043D\u0435\u0433\u043E. \u0421\u043B\u0435\u0434\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0431\u043E\u043A\u043E\u0432\u044B\u0435 \u0446\u0432\u0435\u0442\u0430 \u0443\u0433\u043B\u043E\u0432 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u043B\u0438! \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u00AB\u041F\u0438\u0444-\u041F\u0430\u0444\u00BB.",
          cube: { U: "XXXXXXXXX", F: "XXXXXXGXG", R: "XXXXXXRXR" },
          algos: [{ name: "Пиф-Паф", formula: "R U R' U'", preScramble: "U" }]
        },
        {
          title: "\u042D\u0442\u0430\u043F 2: \u0416\u0435\u043B\u0442\u044B\u0435 \u0443\u0433\u043B\u044B \u043F\u043E \u043C\u0435\u0441\u0442\u0430\u043C",
          desc: "\u041F\u043E\u043A\u0440\u0443\u0442\u0438\u0442\u0435 \u0432\u0435\u0440\u0445\u043D\u044E\u044E \u0433\u0440\u0430\u043D\u044C \u0442\u0430\u043A, \u0447\u0442\u043E\u0431\u044B \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u0438\u043D \u0436\u0435\u043B\u0442\u044B\u0439 \u0443\u0433\u043E\u043B \u0432\u0441\u0442\u0430\u043B \u043D\u0430 \u0441\u0432\u043E\u0435 \u043C\u0435\u0441\u0442\u043E. \u0412\u043E\u0437\u044C\u043C\u0438\u0442\u0435 \u043A\u0443\u0431\u0438\u043A \u0442\u0430\u043A, \u0447\u0442\u043E\u0431\u044B \u044D\u0442\u043E\u0442 \u0443\u0433\u043E\u043B \u0431\u044B\u043B \u0441\u043F\u0440\u0430\u0432\u0430-\u0441\u043F\u0435\u0440\u0435\u0434\u0438. \u041F\u0440\u0438\u043C\u0435\u043D\u044F\u0439\u0442\u0435 \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C, \u043F\u043E\u043A\u0430 \u0432\u0441\u0435 \u0443\u0433\u043B\u044B \u043D\u0435 \u0437\u0430\u0439\u043C\u0443\u0442 \u0441\u0432\u043E\u0438 \u043C\u0435\u0441\u0442\u0430.",
          cube: { U: "YXYXXXYXY", F: "BXOXXXGXG", R: "OXBXXXRXR" },
          algos: [{ name: "Перестановка", formula: "U R U' L' U R' U' L", preScramble: "U2" }]
        },
        {
          title: "\u042D\u0442\u0430\u043F 3: \u0420\u0430\u0437\u0432\u043E\u0440\u043E\u0442 \u0436\u0435\u043B\u0442\u044B\u0445 \u0443\u0433\u043B\u043E\u0432",
          desc: "\u041F\u0435\u0440\u0435\u0432\u0435\u0440\u043D\u0438\u0442\u0435 \u043A\u0443\u0431\u0438\u043A \u0431\u0435\u043B\u043E\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u043E\u0439 \u0412\u0412\u0415\u0420\u0425. \u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043D\u0435\u0440\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u043E\u0433\u043E \u0436\u0435\u043B\u0442\u043E\u0433\u043E \u0443\u0433\u043B\u0430 \u0434\u0435\u043B\u0430\u0439\u0442\u0435 \u00AB\u041F\u0438\u0444-\u041F\u0430\u0444\u00BB. \u0417\u0430\u0442\u0435\u043C \u043F\u043E\u043A\u0440\u0443\u0442\u0438\u0442\u0435 \u041D\u0418\u0416\u041D\u042E\u042E \u0433\u0440\u0430\u043D\u044C (D), \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0443\u0433\u043E\u043B.",
          cube: { U: "YXYXXXYXY", F: "GXGXGXGXG", R: "RXRXRXRXR" },
          algos: [{ name: "Разворот", formula: "R U R' U'" }]
        }
      ]
    },
    'mirror': {
      notation: [
        { move: "R", desc: "\u041F\u0440\u0430\u0432\u0430\u044F \u0433\u0440\u0430\u043D\u044C \u043E\u0442 \u0441\u0435\u0431\u044F", icon: "\u2191" },
        { move: "R'", desc: "\u041F\u0440\u0430\u0432\u0430\u044F \u0433\u0440\u0430\u043D\u044C \u043D\u0430 \u0441\u0435\u0431\u044F", icon: "\u2193" },
        { move: "U", desc: "\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u0432\u043B\u0435\u0432\u043E (\u043F\u043E \u0447\u0430\u0441\u043E\u0432\u043E\u0439)", icon: "\u2190" },
        { move: "U'", desc: "\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u0432\u043F\u0440\u0430\u0432\u043E (\u043F\u0440\u043E\u0442\u0438\u0432)", icon: "\u2192" },
        { move: "F", desc: "\u041F\u0435\u0440\u0435\u0434\u043D\u044F\u044F \u043F\u043E \u0447\u0430\u0441\u043E\u0432\u043E\u0439", icon: "\u21BB" },
        { move: "F'", desc: "\u041F\u0435\u0440\u0435\u0434\u043D\u044F\u044F \u043F\u0440\u043E\u0442\u0438\u0432 \u0447\u0430\u0441\u043E\u0432\u043E\u0439", icon: "\u21BA" },
      ],
      steps: [
        {
          title: "\u0412\u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u0432 Mirror Blocks",
          desc: "Mirror Blocks \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044F \u0422\u041E\u0427\u041D\u041E \u0422\u0410\u041A \u0416\u0415, \u043A\u0430\u043A \u043E\u0431\u044B\u0447\u043D\u044B\u0439 3x3. \u0413\u043B\u0430\u0432\u043D\u043E\u0435 \u043E\u0442\u043B\u0438\u0447\u0438\u0435: \u0432\u043C\u0435\u0441\u0442\u043E \u0446\u0432\u0435\u0442\u043E\u0432 \u0437\u0434\u0435\u0441\u044C \u043D\u0443\u0436\u043D\u043E \u043E\u0440\u0438\u0435\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u043D\u0430 \u0442\u043E\u043B\u0449\u0438\u043D\u0443 \u0438 \u0444\u043E\u0440\u043C\u0443 \u0434\u0435\u0442\u0430\u043B\u0435\u0439. \u041A\u043E\u0433\u0434\u0430 \u0431\u043B\u043E\u043A \u0441\u0442\u043E\u0438\u0442 \u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E, \u043E\u043D \u043E\u0431\u0440\u0430\u0437\u0443\u0435\u0442 \u043F\u043B\u043E\u0441\u043A\u0443\u044E \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u044C.",
          cube: { U: "XXXXXXXXX", F: "XXXXXXXXX", R: "XXXXXXXXX" },
          algos: []
        },
        {
          title: "\u042D\u0442\u0430\u043F 1: \u041D\u0438\u0436\u043D\u0438\u0439 \u043A\u0440\u0435\u0441\u0442",
          desc: "\u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0441\u0430\u043C\u044B\u0439 \u0442\u043E\u043B\u0441\u0442\u044B\u0439 \u0446\u0435\u043D\u0442\u0440. \u041F\u043E\u0434\u0432\u043E\u0434\u0438\u0442\u0435 \u043A \u043D\u0435\u043C\u0443 \u0441\u0430\u043C\u044B\u0435 \u0442\u043E\u043B\u0441\u0442\u044B\u0435 \u0440\u0435\u0431\u0440\u0430, \u043F\u043E\u043A\u0430 \u043D\u0435 \u0441\u043E\u0431\u0435\u0440\u0435\u0442\u0435 \u043A\u0440\u0435\u0441\u0442. \u0420\u0435\u0431\u0440\u0430 \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u0432\u0440\u043E\u0432\u0435\u043D\u044C \u043D\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u0441 \u043D\u0438\u0436\u043D\u0438\u043C \u0446\u0435\u043D\u0442\u0440\u043E\u043C, \u043D\u043E \u0438 \u0441 \u0431\u043E\u043A\u043E\u0432\u044B\u043C\u0438.",
          cube: { U: "XSXSSSXSX", F: "XSXXSXXXX", R: "XSXXSXXXX" },
          algos: []
        },
        {
          title: "\u042D\u0442\u0430\u043F 2: \u041D\u0438\u0436\u043D\u0438\u0435 \u0443\u0433\u043B\u044B",
          desc: "\u0418\u0449\u0438\u0442\u0435 \u0441\u0430\u043C\u044B\u0435 \u0431\u043E\u043B\u044C\u0448\u0438\u0435 \u0443\u0433\u043B\u044B \u043D\u0430 \u0432\u0435\u0440\u0445\u043D\u0435\u043C \u0441\u043B\u043E\u0435. \u041F\u043E\u0434\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0445 \u043A \u043D\u0443\u0436\u043D\u043E\u043C\u0443 \u043C\u0435\u0441\u0442\u0443 \u0438 \u0437\u0430\u0433\u043E\u043D\u044F\u0439\u0442\u0435 \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E \u041F\u0438\u0444-\u041F\u0430\u0444\u0430, \u043F\u043E\u043A\u0430 \u043E\u043D\u0438 \u043D\u0435 \u0432\u0441\u0442\u0430\u043D\u0443\u0442 \u0432\u0440\u043E\u0432\u0435\u043D\u044C.",
          cube: { U: "XXXXXXXXX", F: "XXXXXXSSS", R: "XXXXXXSSS" },
          algos: [{ name: "\u041F\u0438\u0444-\u041F\u0430\u0444", formula: "R U R' U'" }]
        },
        {
          title: "\u042D\u0442\u0430\u043F 3: \u0412\u0442\u043E\u0440\u043E\u0439 \u0441\u043B\u043E\u0439",
          desc: "\u041D\u0430 \u0432\u0435\u0440\u0445\u043D\u0435\u043C \u0441\u043B\u043E\u0435 \u0438\u0449\u0438\u0442\u0435 \u0440\u0435\u0431\u0440\u043E, \u0442\u043E\u043B\u0449\u0438\u043D\u0430 \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u0431\u043E\u043A\u043E\u0432\u044B\u043C \u0446\u0435\u043D\u0442\u0440\u043E\u043C. \u0412 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0438 \u043E\u0442 \u0442\u043E\u0433\u043E, \u043A\u0443\u0434\u0430 \u0435\u0433\u043E \u0437\u0430\u0433\u043D\u0430\u0442\u044C, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C.",
          cube: { U: "XXXXXXXXX", F: "XXXSSSSSS", R: "XXXSSSSSS" },
          algos: [
            { name: "\u041D\u0430\u043F\u0440\u0430\u0432\u043E", formula: "U R U' R' U' F' U F" },
            { name: "\u041D\u0430\u043B\u0435\u0432\u043E", formula: "U' L' U L U F U' F'" }
          ]
        },
        {
          title: "\u042D\u0442\u0430\u043F 4: \u0412\u0435\u0440\u0445\u043D\u0438\u0439 \u043A\u0440\u0435\u0441\u0442 \u0438 \u0448\u0430\u043F\u043A\u0430",
          desc: "\u041E\u0441\u0442\u0430\u0432\u0448\u0438\u0435\u0441\u044F \u044D\u0442\u0430\u043F\u044B \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u044E\u0442\u0441\u044F \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0430\u043D\u0430\u043B\u043E\u0433\u0438\u0447\u043D\u043E \u043A\u0443\u0431\u0438\u043A\u0443 3x3. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C\u044B \u0434\u043B\u044F 3\u04453.",
          cube: { U: "XSXSSSXSX", F: "SSSSSSSSS", R: "SSSSSSSSS" },
          algos: [
            { name: "\u0413\u0430\u043B\u043A\u0430", formula: "F R U R' U' F'" },
            { name: "\u0420\u044B\u0431\u043A\u0430", formula: "R U R' U R U2 R'" },
            { name: "\u041F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430", formula: "U R U' L' U R' U' L" }
          ]
        }
      ]
    },
    'pyraminx': {
      notation: [
        { move: "U / u", desc: "\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u0433\u0440\u0430\u043D\u044C / \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u0443\u0433\u043E\u043B\u043E\u043A", icon: "\u21BB" },
        { move: "L / l", desc: "\u041B\u0435\u0432\u0430\u044F \u0433\u0440\u0430\u043D\u044C / \u043B\u0435\u0432\u044B\u0439 \u0443\u0433\u043E\u043B\u043E\u043A", icon: "\u21BB" },
        { move: "R / r", desc: "\u041F\u0440\u0430\u0432\u0430\u044F \u0433\u0440\u0430\u043D\u044C / \u043F\u0440\u0430\u0432\u044B\u0439 \u0443\u0433\u043E\u043B\u043E\u043A", icon: "\u21BB" },
        { move: "B / b", desc: "\u0417\u0430\u0434\u043D\u044F\u044F \u0433\u0440\u0430\u043D\u044C / \u0437\u0430\u0434\u043D\u0438\u0439 \u0443\u0433\u043E\u043B\u043E\u043A", icon: "\u21BB" },
        { move: "'", desc: "\u0428\u0442\u0440\u0438\u0445 \u2014 \u043F\u043E\u0432\u043E\u0440\u043E\u0442 \u043F\u0440\u043E\u0442\u0438\u0432 \u0447\u0430\u0441\u043E\u0432\u043E\u0439", icon: "\u21BA" },
      ],
      steps: [
        {
          title: "\u042D\u0442\u0430\u043F 1: \u0423\u0433\u043E\u043B\u043A\u0438 \u0438 \u0426\u0435\u043D\u0442\u0440\u044B",
          desc: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0432\u0435\u0440\u043D\u0438\u0442\u0435 \u0432\u0441\u0435 \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0438\u0435 \u0443\u0433\u043E\u043B\u043A\u0438 (u, l, r, b) \u0442\u0430\u043A, \u0447\u0442\u043E\u0431\u044B \u0438\u0445 \u0446\u0432\u0435\u0442\u0430 \u0441\u043E\u0432\u043F\u0430\u043B\u0438 \u0441 \u043F\u0440\u0438\u043B\u0435\u0433\u0430\u044E\u0449\u0438\u043C\u0438 \u0446\u0435\u043D\u0442\u0440\u0430\u043C\u0438. \u0417\u0430\u0442\u0435\u043C \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0446\u0432\u0435\u0442 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u0436\u0435\u043B\u0442\u044B\u0439) \u0438 \u0441\u043E\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0441\u0435 \u0442\u0440\u0438 \u0436\u0435\u043B\u0442\u044B\u0445 \u0446\u0435\u043D\u0442\u0440\u0430 \u043D\u0430 \u043E\u0434\u043D\u043E\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u0435.",
          cube: { U: "XXXXXXXXX", F: "YXXYYXYYY", R: "XXXXXXXXX" },
          algos: []
        },
        {
          title: "\u042D\u0442\u0430\u043F 2: \u041F\u0435\u0440\u0432\u044B\u0439 \u0441\u043B\u043E\u0439",
          desc: "\u041F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043F\u0438\u0440\u0430\u043C\u0438\u0434\u043A\u0443 \u0436\u0435\u043B\u0442\u043E\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u043E\u0439 \u0432\u043D\u0438\u0437. \u0418\u0449\u0438\u0442\u0435 \u043D\u0430 \u0432\u0435\u0440\u0445\u043D\u0435\u043C \u0441\u043B\u043E\u0435 \u0440\u0435\u0431\u0440\u0430, \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0449\u0438\u0435 \u0436\u0435\u043B\u0442\u044B\u0439 \u0446\u0432\u0435\u0442. \u041F\u043E\u0434\u0432\u0435\u0434\u0438\u0442\u0435 \u0440\u0435\u0431\u0440\u043E \u043A \u0441\u0432\u043E\u0435\u043C\u0443 \u043C\u0435\u0441\u0442\u0443 \u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u041F\u0438\u0444-\u041F\u0430\u0444 \u0434\u043B\u044F \u043F\u0438\u0440\u0430\u043C\u0438\u0434\u043A\u0438, \u0447\u0442\u043E\u0431\u044B \u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0435\u0433\u043E \u0432\u043D\u0438\u0437.",
          cube: { U: "XXXXXXXXX", F: "YYYYYYYYY", R: "XXXXXXXXX" },
          algos: [
            { name: "\u041F\u0440\u0430\u0432\u044B\u0439 \u041F\u0438\u0444-\u041F\u0430\u0444", formula: "R' L R L'" },
            { name: "\u041B\u0435\u0432\u044B\u0439 \u041F\u0438\u0444-\u041F\u0430\u0444", formula: "L R' L' R" }
          ]
        },
        {
          title: "\u042D\u0442\u0430\u043F 3: \u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0441\u043B\u043E\u0439 (\u0413\u043B\u0430\u0437\u0430)",
          desc: "\u0415\u0441\u043B\u0438 \u043D\u0430 \u0432\u0435\u0440\u0445\u043D\u0435\u043C \u0441\u043B\u043E\u0435 \u0434\u0432\u0430 \u0440\u0435\u0431\u0440\u0430 \u043F\u0435\u0440\u0435\u0432\u0435\u0440\u043D\u0443\u0442\u044B \u043D\u0430 \u0441\u0432\u043E\u0438\u0445 \u043C\u0435\u0441\u0442\u0430\u0445, \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u0435 \u044D\u0442\u043E\u0442 \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C.",
          cube: { U: "XXXXXXXXX", F: "GXXGGGGGG", R: "XXXXXXXXX" },
          algos: [{ name: "\u0413\u043B\u0430\u0437\u0430", formula: "R' L R L' U L' U' L" }]
        },
        {
          title: "\u042D\u0442\u0430\u043F 4: \u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0441\u043B\u043E\u0439 (\u041A\u0440\u0443\u0433\u043E\u0432\u043E\u0440\u043E\u0442)",
          desc: "\u0415\u0441\u043B\u0438 \u0432\u0441\u0435 \u0442\u0440\u0438 \u0440\u0435\u0431\u0440\u0430 \u0441\u0442\u043E\u044F\u0442 \u043D\u0435 \u043D\u0430 \u0441\u0432\u043E\u0438\u0445 \u043C\u0435\u0441\u0442\u0430\u0445 \u0438 \u043E\u0431\u0440\u0430\u0437\u0443\u044E\u0442 \u00AB\u0432\u0435\u0435\u0440\u00BB, \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0439\u0442\u0435 \u0430\u043B\u0433\u043E\u0440\u0438\u0442\u043C \u043A\u0440\u0443\u0433\u043E\u0432\u043E\u0440\u043E\u0442\u0430.",
          cube: { U: "XXXXXXXXX", F: "BXXBGGGGG", R: "XXXXXXXXX" },
          algos: [{ name: "\u041A\u0440\u0443\u0433\u043E\u0432\u043E\u0440\u043E\u0442", formula: "R U R' U R U R'" }]
        }
      ]
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 lg:py-12 max-w-6xl h-[calc(100vh-4rem)] overflow-y-auto">
      {activeAlgo && (
        <AlgorithmModal algo={activeAlgo.formula} name={activeAlgo.name} step={activeAlgo.step} puzzleType={activeAlgo.puzzleType || '3x3'} preScramble={activeAlgo.preScramble || ''} onClose={() => setActiveAlgo(null)} />
      )}

      <div className="text-center mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl lg:text-5xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-600"
        >
          Обучение
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-brand-800/80 dark:text-white/60 max-w-2xl mx-auto"
        >
          Изучите базовые алгоритмы и язык вращений, чтобы научиться собирать головоломки.
        </motion.p>
      </div>
      
      <div className="flex bg-black/20 rounded-xl p-1 mb-10 mx-auto max-w-lg shadow-inner">
        <button onClick={() => setActivePuzzle('3x3')} className={`flex-1 py-3 rounded-lg transition-all font-bold ${activePuzzle === '3x3' ? 'bg-brand-500 text-brand-900 shadow-md' : 'text-brand-800 hover:text-brand-900 dark:text-white/50 dark:hover:text-white'}`}>3x3</button>
        <button onClick={() => setActivePuzzle('2x2')} className={`flex-1 py-3 rounded-lg transition-all font-bold ${activePuzzle === '2x2' ? 'bg-brand-500 text-brand-900 shadow-md' : 'text-brand-800 hover:text-brand-900 dark:text-white/50 dark:hover:text-white'}`}>2x2</button>
        <button onClick={() => setActivePuzzle('mirror')} className={`flex-1 py-3 rounded-lg transition-all font-bold ${activePuzzle === 'mirror' ? 'bg-brand-500 text-brand-900 shadow-md' : 'text-brand-800 hover:text-brand-900 dark:text-white/50 dark:hover:text-white'}`}>Mirror</button>
        <button onClick={() => setActivePuzzle('pyraminx')} className={`flex-1 py-3 rounded-lg transition-all font-bold ${activePuzzle === 'pyraminx' ? 'bg-brand-500 text-brand-900 shadow-md' : 'text-brand-800 hover:text-brand-900 dark:text-white/50 dark:hover:text-white'}`}>Pyraminx</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/50 dark:bg-black/20 backdrop-blur-sm rounded-3xl p-8 border border-black/5 dark:border-white/10 shadow-xl">
            <h2 className="text-2xl font-black mb-6 text-brand-900 dark:text-white flex items-center gap-2 tracking-tight">
              <span className="text-brand-500">Язык вращений</span>
            </h2>
            <div className="grid gap-3">
              {tutorialData[activePuzzle].notation.map((item, i) => (
                <div key={i} className="flex items-center gap-4 bg-black/5 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5">
                  <div className="w-14 h-14 flex items-center justify-center bg-brand-500/20 text-brand-600 dark:text-brand-400 font-bold text-2xl rounded-xl border border-brand-500/30">
                    {item.move}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-semibold text-brand-900 dark:text-white/90">{item.desc}</div>
                    <div className="text-2xl mt-1 text-brand-500">{item.icon}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-brand-500/10 rounded-xl border border-brand-500/20">
              <p className="text-sm text-brand-800 dark:text-white/70">
                <strong className="text-brand-600 dark:text-brand-400">Подсказка:</strong> Буква со штрихом (') означает вращение против часовой стрелки. Двойка (2) означает двойной поворот (на 180°).
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {tutorialData[activePuzzle].steps.map((step, i) => (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={i} 
              className="bg-white/50 dark:bg-black/20 backdrop-blur-sm rounded-3xl p-8 md:p-10 border border-black/5 dark:border-white/10 shadow-2xl"
            >
              <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
                <div className="w-full sm:w-64 lg:w-72 shrink-0 bg-black/5 dark:bg-black/20 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-center p-4">
                  {activePuzzle === 'mirror'
                    ? <MirrorCubeIcon F={step.cube.F} U={step.cube.U} R={step.cube.R || "XXXXXXXXX"} />
                    : <CubeIcon U={step.cube.U} F={step.cube.F} R={step.cube.R} type={activePuzzle} />
                  }
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black mb-4 text-brand-900 dark:text-white">{step.title}</h3>
                  <p className="text-lg text-brand-800/80 dark:text-white/70 mb-6 leading-relaxed">
                    {step.desc}
                  </p>
                  
                  {step.algos.length > 0 && (
                    <div className="space-y-3">
                      {step.algos.map((algo: any, j: number) => (
                        <div key={j} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-black/5 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5">
                          <div>
                            <div className="text-sm text-brand-500 font-medium mb-1">{algo.name}</div>
                            <code className="font-mono text-lg font-bold text-brand-900 dark:text-white tracking-widest bg-black/5 dark:bg-white/5 px-2 py-1 rounded">
                              {algo.formula}
                            </code>
                          </div>
                          {activePuzzle !== 'mirror' && (
                            <button
                              onClick={() => setActiveAlgo({ formula: algo.formula, step: i + 1, name: algo.name, puzzleType: activePuzzle })}
                              className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <span className="text-xl">▶</span> Показать
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
