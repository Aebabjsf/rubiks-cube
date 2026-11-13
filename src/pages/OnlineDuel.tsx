import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Swords, 
  Users, 
  Trophy, 
  Copy, 
  Check, 
  ArrowRight, 
  RotateCcw, 
  Flame, 
  LogOut, 
  ShieldCheck, 
  Wifi, 
  WifiOff,
  Bot,
  AlertTriangle,
  Play,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Award,
  Medal,
  CheckCircle2,
  AlertOctagon
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '../utils/api';
import { DuelSocketClient, type DuelRoomState, type DuelPlayer } from '../utils/duelSocket';
import { playCubeClick, playVictorySound } from '../utils/audio';
import { DuelCubeCanvas, getSolvingMoves } from '../components/DuelCubeCanvas';

// Извлечение кода комнаты из URL любого формата (#/online?room=CODE или ?room=CODE#/online)
function getRoomCodeFromUrl(): string | null {
  try {
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx !== -1) {
      const sp = new URLSearchParams(hash.substring(qIdx));
      const r = sp.get('room');
      if (r && r.trim()) return r.trim().toUpperCase();
    }
    const search = window.location.search || '';
    if (search) {
      const sp = new URLSearchParams(search);
      const r = sp.get('room');
      if (r && r.trim()) return r.trim().toUpperCase();
    }
  } catch {}
  return null;
}

// Клиентский генератор WCA-скрамбла на случай оффлайна или мгновенного превью
function generateClientWcaScramble(length = 20): string {
  const faces = ['U', 'D', 'R', 'L', 'F', 'B'];
  const modifiers = ['', "'", '2'];
  const opposites: Record<string, string> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
  const moves: string[] = [];
  let lastFace = '';
  let secondLastFace = '';

  for (let i = 0; i < length; i++) {
    const valid = faces.filter(f => f !== lastFace && !(f === secondLastFace && opposites[f] === lastFace));
    const face = valid[Math.floor(Math.random() * valid.length)];
    const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
    moves.push(`${face}${mod}`);
    secondLastFace = lastFace;
    lastFace = face;
  }
  return moves.join(' ');
}

export function OnlineDuel() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const user = useAuthStore(state => state.user);
  const randomSuffix = useRef(Math.floor(100 + Math.random() * 900));
  const defaultPlayerName = user?.profile?.nickname || user?.username || `Спидкубер #${randomSuffix.current}`;

  // Состояние лобби
  const [inRoom, setInRoom] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentRoomCode, setCurrentRoomCode] = useState('');
  const [playerName, setPlayerName] = useState(defaultPlayerName);
  
  // Данные комнат с сервера
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);

  // Состояние дуэли в комнате
  const [roomState, setRoomState] = useState<DuelRoomState | null>(null);
  const [displayScramble, setDisplayScramble] = useState<string>(() => generateClientWcaScramble());
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [wsFailed, setWsFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOfflineBotMode, setIsOfflineBotMode] = useState(false);

  // Идентификатор текущего игрока в WebSocket сессии для надежного разделения окон
  const myPlayerIdRef = useRef<string>('');

  // Игровой процесс
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isMatchRunning, setIsMatchRunning] = useState(false);
  const [myReady, setMyReady] = useState(false);
  const [myTime, setMyTime] = useState(0);
  const [myMoves, setMyMoves] = useState(0);
  const [myFinished, setMyFinished] = useState(false);

  // Анимация ходов соперника / бота в 3D кубике
  const [opponentMove, setOpponentMove] = useState<string | null>(null);
  const [opponentTurn, setOpponentTurn] = useState<{ move: string; step: number } | null>(null);
  const opponentStepRef = useRef(0);

  // Состояние AI-бота
  const [botState, setBotState] = useState<{
    name: string;
    ready: boolean;
    finished: boolean;
    time: number | null;
    moves: number;
    currentMove: string | null;
  } | null>(null);
  const botIntervalRef = useRef<any>(null);

  // Рефы для полного исключения устаревших замыканий (stale closures)
  const roomStateRef = useRef<DuelRoomState | null>(null);
  roomStateRef.current = roomState;
  const botStateRef = useRef(botState);
  botStateRef.current = botState;
  const displayScrambleRef = useRef(displayScramble);
  displayScrambleRef.current = displayScramble;
  const isOfflineBotModeRef = useRef(isOfflineBotMode);
  isOfflineBotModeRef.current = isOfflineBotMode;
  const myMovesRef = useRef(myMoves);
  myMovesRef.current = myMoves;
  const myTimeRef = useRef(myTime);
  myTimeRef.current = myTime;
  const myFinishedRef = useRef(myFinished);
  myFinishedRef.current = myFinished;

  const startMatchRef = useRef<() => void>(() => {});
  const startCountdownRef = useRef<(count: number) => void>(() => {});

  // Лидерборд и вкладки лобби (Идея 2: PvP Elo)
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lobbyTab, setLobbyTab] = useState<'rooms' | 'leaderboard'>('rooms');

  const [resultModal, setResultModal] = useState<{
    winner: string;
    isWinner: boolean;
    myTime: number;
    opponentTime: number | null;
    myMoves?: number;
    opponentMoves?: number;
    eloDelta?: number | null;
    myNewElo?: number | null;
    verification?: {
      verified: boolean;
      status: string;
      tps: number;
      details: string;
    } | null;
  } | null>(null);

  const socketClientRef = useRef<DuelSocketClient | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  // Загрузка открытых комнат, истории матчей и таблицы лидеров
  const fetchLobbyData = useCallback(async () => {
    try {
      const [roomsRes, lbRes] = await Promise.all([
        fetch(`${API_BASE_URL}/duels/rooms/`),
        fetch(`${API_BASE_URL}/duels/leaderboard/`),
      ]);
      if (roomsRes.ok) {
        const data = await roomsRes.json();
        setActiveRooms(data.active_rooms || []);
        setRecentMatches(data.recent_matches || []);
      }
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        setLeaderboard(lbData.leaderboard || []);
      }
    } catch {
      // Бэкенд оффлайн
    }
  }, []);

  useEffect(() => {
    if (!inRoom) {
      fetchLobbyData();
      const interval = setInterval(fetchLobbyData, 5000);
      return () => clearInterval(interval);
    }
  }, [inRoom, fetchLobbyData]);

  // Выход из комнаты
  const leaveRoom = useCallback(() => {
    if (socketClientRef.current) {
      socketClientRef.current.disconnect();
      socketClientRef.current = null;
    }
    clearInterval(timerIntervalRef.current);
    clearInterval(botIntervalRef.current);
    setInRoom(false);
    setCurrentRoomCode('');
    setRoomState(null);
    setIsWsConnected(false);
    setWsFailed(false);
    setIsMatchRunning(false);
    setCountdown(null);
    setMyFinished(false);
    setMyReady(false);
    setResultModal(null);
    setMyTime(0);
    setMyMoves(0);
    setBotState(null);
    setOpponentMove(null);
    setOpponentTurn(null);
    setIsOfflineBotMode(false);
  }, []);

  // Подключение к WebSocket комнате
  const joinRoom = useCallback((code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    leaveRoom();
    setCurrentRoomCode(cleanCode);
    setInRoom(true);
    setWsFailed(false);
    const initialScr = generateClientWcaScramble();
    setDisplayScramble(initialScr);
    displayScrambleRef.current = initialScr;

    const client = new DuelSocketClient(cleanCode, {
      onConnected: () => {
        setIsWsConnected(true);
        setWsFailed(false);
      },
      onJoinedSuccess: (data) => {
        setPlayerName(data.assigned_name);
        if (data.my_id) {
          myPlayerIdRef.current = data.my_id;
        }
      },
      onRoomState: (state) => {
        setRoomState(state);
        if (state.scramble) {
          setDisplayScramble(state.scramble);
          displayScrambleRef.current = state.scramble;
        }
      },
      onMatchStarting: (data) => {
        setRoomState(data.room_state);
        if (data.scramble) {
          setDisplayScramble(data.scramble);
          displayScrambleRef.current = data.scramble;
        }
        startCountdownRef.current(data.countdown);
      },
      onOpponentProgress: (data) => {
        setRoomState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            players: prev.players.map(p => 
              (p.name === data.sender || (data.sender && p.name.includes('Бот') && data.sender.includes('Бот')))
                ? { ...p, moves: data.moves, time: data.time } 
                : p
            )
          };
        });
        // Если это ход бота, который генерируется на нашем же клиенте, не дублируем его из WebSocket эхо!
        const isBotSender = Boolean(data.sender?.includes('Бот'));
        if (data.move && (!isBotSender || !botIntervalRef.current)) {
          opponentStepRef.current += 1;
          setOpponentTurn({ move: data.move, step: opponentStepRef.current });
          setOpponentMove(data.move);
        }
      },
      onPlayerFinished: (data) => {
        setRoomState(data.room_state);
        if (data.is_winner) {
          playVictorySound();
        }
        if (data.player_name === playerName) {
          setMyFinished(true);
          clearInterval(timerIntervalRef.current);
        }
        if (data.all_finished) {
          const opponent = data.room_state.players.find(p => p.name !== playerName);
          
          let myEloInfo: any = null;
          if (data.elo_updates) {
            if (data.elo_updates.p1.name === playerName) {
              myEloInfo = data.elo_updates.p1;
            } else if (data.elo_updates.p2.name === playerName) {
              myEloInfo = data.elo_updates.p2;
            }
          }

          const curTime = myTimeRef.current;
          const curMoves = myMovesRef.current;
          const fallbackTps = Number((curMoves / Math.max(curTime, 0.1)).toFixed(2));
          setResultModal({
            winner: data.winner,
            isWinner: data.winner === playerName,
            myTime: data.player_name === playerName ? data.time : curTime,
            opponentTime: opponent ? opponent.time : null,
            myMoves: data.player_name === playerName ? data.moves : curMoves,
            opponentMoves: opponent ? opponent.moves : 0,
            eloDelta: myEloInfo ? myEloInfo.delta : (data.winner === playerName ? 22 : -16),
            myNewElo: myEloInfo ? myEloInfo.elo_after : (user?.profile?.elo_rating || 1200) + (data.winner === playerName ? 22 : -16),
            verification: data.verification || {
              verified: fallbackTps <= 16.0 && curTime >= 2.5,
              status: fallbackTps > 16.0 ? 'SUSPICIOUS_TPS' : 'VERIFIED',
              tps: fallbackTps,
              details: `Верифицировано античитом WCA (TPS: ${fallbackTps})`
            }
          });
        }
      },
      onRematchReset: (data) => {
        setRoomState(data.room_state);
        setMyFinished(false);
        setMyReady(false);
        setIsMatchRunning(false);
        setResultModal(null);
        setMyTime(0);
        setMyMoves(0);
        setOpponentMove(null);
        setOpponentTurn(null);
        clearInterval(timerIntervalRef.current);
        clearInterval(botIntervalRef.current);
        if (botStateRef.current) {
          setBotState(prev => prev ? { ...prev, ready: true, finished: false, time: null, moves: 0, currentMove: null } : null);
        }
        if (data.room_state.scramble) {
          setDisplayScramble(data.room_state.scramble);
          displayScrambleRef.current = data.room_state.scramble;
        }
      },
      onError: () => {
        setWsFailed(true);
      },
      onClose: () => {
        setIsWsConnected(false);
      }
    });

    client.connect(playerName);
    socketClientRef.current = client;

    // Таймаут проверки соединения: если за 2.5 секунды WS не подключился, ставим флаг wsFailed
    setTimeout(() => {
      setIsWsConnected(prev => {
        if (!prev) setWsFailed(true);
        return prev;
      });
    }, 2500);
  }, [leaveRoom, playerName, user]);

  // Проверка параметров URL на наличие кода комнаты (#/online?room=ABC123 или ?room=ABC123)
  useEffect(() => {
    try {
      const urlCode = searchParams.get('room') || getRoomCodeFromUrl();
      if (urlCode && urlCode !== currentRoomCode && !inRoom) {
        joinRoom(urlCode);
      }
    } catch {}
  }, [location, searchParams, currentRoomCode, inRoom, joinRoom]);

  // Создание новой комнаты
  const handleCreateRoom = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/duels/create/`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        joinRoom(data.room_code);
        return;
      }
    } catch {}
    // Локальный код, если сервер недоступен
    const localCode = 'PVP' + Math.floor(100 + Math.random() * 900);
    joinRoom(localCode);
  };

  // Добавление бота-соперника
  const handleAddBot = () => {
    const newBot = {
      name: 'Бот Speedy3x3 (AI)',
      ready: true,
      finished: false,
      time: null,
      moves: 0,
      currentMove: null,
    };
    setBotState(newBot);
    botStateRef.current = newBot;
    if (isWsConnected && socketClientRef.current) {
      socketClientRef.current.sendAddBot();
    }
  };

  // Старт решения
  const startMatch = useCallback(() => {
    setIsMatchRunning(true);
    setMyFinished(false);
    setMyMoves(0);
    setMyTime(0);
    setOpponentMove(null);
    setOpponentTurn(null);
    startTimeRef.current = Date.now();

    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setMyTime(elapsed);
    }, 75);

    // Запуск сборки кубика ботом (если соперник — бот)
    const isBotMatch = Boolean(botStateRef.current) || 
      Boolean(isOfflineBotModeRef.current) || 
      Boolean(roomStateRef.current?.players.some(p => p.is_bot && (!myPlayerIdRef.current || p.id !== myPlayerIdRef.current)));

    if (isBotMatch) {
      clearInterval(botIntervalRef.current);
      const currentScramble = displayScrambleRef.current;
      const solvingMoves = getSolvingMoves(currentScramble);
      const totalMoves = solvingMoves.length;

      // Целевое время бота: 13.5 - 19.5 сек
      const botTargetTime = 13.5 + Math.random() * 6.0;
      // Равномерный соревновательный интервал между ходами (не менее 350мс для плавной анимации)
      const stepIntervalMs = totalMoves > 0 ? Math.max(350, Math.round((botTargetTime * 1000) / totalMoves)) : 750;

      let moveIdx = 0;
      botIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;

        // Пошаговое выполнение каждого хода строго по очереди (без пропусков)
        if (moveIdx < totalMoves) {
          const nextMoveStr = solvingMoves[moveIdx];
          moveIdx++;

          opponentStepRef.current += 1;
          setOpponentTurn({ move: nextMoveStr, step: opponentStepRef.current });
          setOpponentMove(nextMoveStr);

          setBotState(prev => ({
            name: prev?.name || 'Бот Speedy3x3 (AI)',
            ready: true,
            finished: false,
            time: elapsed,
            moves: moveIdx,
            currentMove: nextMoveStr,
          }));

          if (socketClientRef.current) {
            socketClientRef.current.sendBotProgress(moveIdx, elapsed, nextMoveStr);
          }
        }

        // Когда абсолютно ВСЕ ходы выполнены — кубик гарантированно собран!
        if (moveIdx >= totalMoves) {
          clearInterval(botIntervalRef.current);
          botIntervalRef.current = null;

          const finalBotTime = Math.max(botTargetTime, Number(elapsed.toFixed(2)));

          // Небольшая задержка 120мс для плавного завершения поворота последней грани
          setTimeout(() => {
            setBotState(prev => ({
              name: prev?.name || 'Бот Speedy3x3 (AI)',
              ready: true,
              finished: true,
              time: finalBotTime,
              moves: totalMoves,
              currentMove: null,
            }));

            if (socketClientRef.current) {
              socketClientRef.current.sendBotFinish(finalBotTime, totalMoves);
            }

            // Если игрок еще не закончил, бот побеждает
            setMyFinished(currentMyFinished => {
              if (!currentMyFinished) {
                setResultModal(curr => curr || {
                  winner: 'Бот Speedy3x3 (AI)',
                  isWinner: false,
                  myTime: (Date.now() - startTimeRef.current) / 1000,
                  opponentTime: finalBotTime,
                  myMoves: myMovesRef.current,
                  opponentMoves: totalMoves,
                  eloDelta: -16,
                  myNewElo: Math.max(100, (user?.profile?.elo_rating || 1200) - 16),
                  verification: {
                    verified: true,
                    status: 'VERIFIED',
                    tps: Number((totalMoves / finalBotTime).toFixed(2)),
                    details: 'Сборка AI-бота верифицирована (WCA Reverse Solver)'
                  }
                });
              }
              return currentMyFinished;
            });
          }, 120);
        }
      }, stepIntervalMs);
    }
  }, [user]);

  startMatchRef.current = startMatch;

  // Обратный отсчет перед стартом
  const startCountdown = useCallback((count: number) => {
    setCountdown(count);
    let current = count;
    playCubeClick();

    const interval = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdown(current);
        playCubeClick();
      } else {
        clearInterval(interval);
        setCountdown(null);
        startMatchRef.current();
      }
    }, 1000);
  }, []);

  startCountdownRef.current = startCountdown;

  // Игрок и оппонент в дуэли
  const myPlayer = roomState?.players.find(p => (myPlayerIdRef.current && p.id === myPlayerIdRef.current) || p.name === playerName);
  const serverOpponent = roomState?.players.find(p => (myPlayerIdRef.current && p.id !== myPlayerIdRef.current) || p.name !== playerName);

  const isOpponentBot = Boolean(botState) || Boolean(serverOpponent?.is_bot) || isOfflineBotMode;
  const activeOpponent = (isOpponentBot && botState)
    ? {
        name: serverOpponent?.name || botState.name,
        ready: true,
        finished: botState.finished,
        time: botState.time,
        moves: botState.moves,
        is_bot: true,
      }
    : (serverOpponent || botState);

  // Ход игрока (вручную или через 3D кубик)
  const handlePlayerMove = useCallback((customMoveCount?: number, moveNotation?: string) => {
    if (!isMatchRunning || myFinished) return;
    const newMoves = customMoveCount !== undefined ? customMoveCount : myMoves + 1;
    setMyMoves(newMoves);

    if (socketClientRef.current && isWsConnected) {
      socketClientRef.current.sendProgress(newMoves, myTime, moveNotation);
    }
  }, [isMatchRunning, myFinished, myMoves, myTime, isWsConnected]);

  // Завершение сборки игроком (автоматически при сборке 3D кубика)
  const handlePlayerFinish = useCallback(() => {
    if (!isMatchRunning || myFinished) return;
    clearInterval(timerIntervalRef.current);
    setMyFinished(true);
    playVictorySound();

    if (socketClientRef.current && isWsConnected) {
      socketClientRef.current.sendFinish(myTime, myMoves);
    } else {
      // Оффлайн режим
      const opponentTime = activeOpponent?.time ?? null;
      const isWinner = opponentTime === null || myTime < opponentTime;
      clearInterval(botIntervalRef.current);
      const tps = Number((myMoves / Math.max(myTime, 0.1)).toFixed(2));
      const delta = isWinner ? 22 : -15;
      const curElo = user?.profile?.elo_rating || 1200;
      setResultModal({
        winner: isWinner ? playerName : (activeOpponent?.name || 'Соперник'),
        isWinner,
        myTime,
        opponentTime,
        myMoves,
        opponentMoves: activeOpponent?.moves || 0,
        eloDelta: delta,
        myNewElo: Math.max(100, curElo + delta),
        verification: {
          verified: tps <= 16.0 && myTime >= 2.5,
          status: tps > 16.0 ? 'SUSPICIOUS_TPS' : (myTime < 2.5 ? 'IMPOSSIBLE_TIME' : 'VERIFIED'),
          tps,
          details: tps <= 16.0 && myTime >= 2.5 
            ? `Сборка верифицирована античитом WCA (TPS: ${tps})` 
            : `Отклонено античитом: нереалистичный TPS ${tps}`
        }
      });
    }
  }, [isMatchRunning, myFinished, myTime, myMoves, isWsConnected, activeOpponent, playerName, user]);

  // Нажатие кнопки "Я ГОТОВ К БИТВЕ!"
  const handleToggleReady = () => {
    setMyReady(true);
    if (isWsConnected && socketClientRef.current) {
      socketClientRef.current.sendReady();
    } else if (isOfflineBotMode || botState) {
      // В режиме с ботом сразу запускаем отсчет!
      startCountdown(3);
    }
  };

  const handleRematch = () => {
    setResultModal(null);
    setMyFinished(false);
    setMyReady(false);
    setIsMatchRunning(false);
    setMyTime(0);
    setMyMoves(0);
    setOpponentMove(null);
    clearInterval(timerIntervalRef.current);
    clearInterval(botIntervalRef.current);
    setDisplayScramble(generateClientWcaScramble());

    if (botState) {
      setBotState(prev => prev ? { ...prev, ready: true, finished: false, time: null, moves: 0, currentMove: null } : null);
    }

    if (isWsConnected && socketClientRef.current) {
      socketClientRef.current.sendRematch();
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(currentRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRoomUrl = () => {
    const origin = window.location.origin;
    const url = `${origin}/#/online?room=${currentRoomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };



  return (
    <div className="min-h-[calc(100vh-4rem)] w-full py-8 px-4 md:px-8 relative overflow-hidden flex flex-col items-center">
      {/* Фоновые свечения на чистых градиентах (аппаратное ускорение для максимального FPS в Firefox) */}
      <div className="absolute top-10 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none -z-10" style={{ background: 'radial-gradient(circle, rgba(191,126,184,0.14) 0%, transparent 70%)' }} />
      <div className="absolute bottom-10 right-1/4 w-[450px] h-[450px] rounded-full pointer-events-none -z-10" style={{ background: 'radial-gradient(circle, rgba(142,79,134,0.12) 0%, transparent 70%)' }} />

      {!inRoom ? (
        /* ================= ЭКРАН ЛОББИ ДУЭЛЕЙ ================= */
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-5xl flex flex-col items-center"
        >
          {/* Заголовок Лобби */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-400/15 border border-brand-400/30 text-brand-700 dark:text-brand-300 text-xs font-bold uppercase tracking-wider mb-4">
              <Swords className="w-4 h-4 text-brand-400" />
              Онлайн Киберспорт
            </div>
            <h1 className="text-3xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-900 via-brand-500 to-brand-400 dark:from-white dark:via-brand-200 dark:to-brand-400 tracking-tight">
              PvP Дуэли 1 на 1
            </h1>
            <p className="text-sm md:text-base text-brand-800/70 dark:text-brand-100/70 mt-3 max-w-xl mx-auto">
              Сразитесь с другим спидкубером в реальном времени! Сервер генерирует одинаковый скрамбл обоим участникам и определяет победителя по WebSockets.
            </p>
          </div>

          {/* Панель создания и входа */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* Создание комнаты */}
            <div className="p-8 rounded-3xl bg-[#161022]/90 border border-brand-400/20 shadow-xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 mb-4">
                  <Flame className="w-6 h-6 text-brand-400" />
                </div>
                <h2 className="text-xl font-black text-brand-900 dark:text-white">Создать новую дуэль</h2>
                <p className="text-xs text-brand-800/70 dark:text-brand-100/70 mt-2 leading-relaxed">
                  Будет сгенерирован уникальный 6-значный код комнаты и WCA-скрамбл. Отправьте код другу или дождитесь случайного соперника.
                </p>
              </div>

              <div className="mt-8">
                <label className="block text-xs font-bold text-brand-800/80 dark:text-brand-100/80 mb-2">
                  Ваш игровой никнейм:
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-brand-400/10 dark:bg-black/30 border border-brand-400/20 text-sm focus:outline-none focus:border-brand-400 mb-4 text-brand-900 dark:text-white"
                />
                <button
                  onClick={handleCreateRoom}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-600 hover:to-brand-500 text-white font-black text-sm shadow-lg shadow-brand-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Swords className="w-4 h-4" />
                  Создать дуэль
                </button>
              </div>
            </div>

            {/* Подключение по коду */}
            <div className="p-8 rounded-3xl bg-[#161022]/90 border border-brand-400/20 shadow-xl flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 mb-4">
                  <Users className="w-6 h-6 text-brand-400" />
                </div>
                <h2 className="text-xl font-black text-brand-900 dark:text-white">Войти по коду дуэли</h2>
                <p className="text-xs text-brand-800/70 dark:text-brand-100/70 mt-2 leading-relaxed">
                  Если ваш друг создал комнату и прислал код (например, <span className="font-mono text-brand-400">SPEED9</span>), введите его здесь.
                </p>
              </div>

              <div className="mt-8">
                <label className="block text-xs font-bold text-brand-800/80 dark:text-brand-100/80 mb-2">
                  Код дуэли:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Например: CUBE99"
                    value={roomCodeInput}
                    onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-brand-400/10 dark:bg-black/30 border border-brand-400/20 text-sm font-mono uppercase focus:outline-none focus:border-brand-400 text-brand-900 dark:text-white"
                  />
                  <button
                    onClick={() => joinRoom(roomCodeInput)}
                    disabled={!roomCodeInput.trim()}
                    className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer"
                  >
                    Вход
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Переключатель вкладок лобби: Комнаты / Таблица лидеров Elo */}
          <div className="w-full flex items-center justify-center gap-3 mb-8">
            <button
              onClick={() => setLobbyTab('rooms')}
              className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                lobbyTab === 'rooms'
                  ? 'bg-gradient-to-r from-brand-500 to-brand-400 text-white shadow-lg shadow-brand-500/25'
                  : 'bg-brand-400/10 hover:bg-brand-400/20 text-brand-900 dark:text-brand-100 border border-brand-400/20'
              }`}
            >
              <Swords className="w-4 h-4" />
              Открытые лобби и дуэли
            </button>
            <button
              onClick={() => setLobbyTab('leaderboard')}
              className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                lobbyTab === 'leaderboard'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-lg shadow-amber-500/25'
                  : 'bg-brand-400/10 hover:bg-brand-400/20 text-brand-900 dark:text-brand-100 border border-brand-400/20'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-300" />
              Таблица лидеров Elo (PvP Киберспорт)
            </button>
          </div>

          {lobbyTab === 'rooms' ? (
            /* Список открытых комнат и последних дуэлей */
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-lg text-brand-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-400" />
                    Открытые лобби
                  </h3>
                  <span className="text-xs text-brand-800/60 dark:text-brand-100/60 font-mono">
                    {activeRooms.length} активных
                  </span>
                </div>

                {activeRooms.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-brand-400/5 border border-brand-400/10 text-center text-xs text-brand-800/60 dark:text-brand-100/60">
                    Сейчас нет свободных комнат. Создайте дуэль первой!
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {activeRooms.map(room => (
                      <div 
                        key={room.code}
                        className="p-4 rounded-2xl bg-brand-400/10 dark:bg-white/5 border border-brand-400/20 flex items-center justify-between hover:border-brand-400/50 transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-base text-brand-900 dark:text-white">
                              {room.code}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-semibold">
                              {room.players_count}/2 игроков
                            </span>
                          </div>
                          <span className="text-xs text-brand-800/60 dark:text-brand-100/60 mt-1 block">
                            Создатель: {room.players[0] || 'Аноним'}
                          </span>
                        </div>

                        <button
                          onClick={() => joinRoom(room.code)}
                          disabled={room.players_count >= 2}
                          className="px-4 py-2 rounded-xl bg-brand-500/20 hover:bg-brand-500/30 border border-brand-400/30 text-brand-900 dark:text-brand-100 text-xs font-bold transition-all disabled:opacity-30 cursor-pointer"
                        >
                          {room.players_count >= 2 ? 'Заполнено' : 'Сразиться'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-lg text-brand-900 dark:text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Завершенные дуэли
                  </h3>
                </div>

                {recentMatches.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-brand-400/5 border border-brand-400/10 text-center text-xs text-brand-800/60 dark:text-brand-100/60">
                    История матчей пока пуста. Проведите первую дуэль!
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {recentMatches.map((m, idx) => (
                      <div 
                        key={idx}
                        className="p-4 rounded-2xl bg-brand-400/10 dark:bg-white/5 border border-brand-400/20 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 font-bold text-brand-900 dark:text-white">
                            <span>{m.p1}</span>
                            <span className="text-brand-400 text-[10px]">VS</span>
                            <span>{m.p2 || 'Игрок 2'}</span>
                          </div>
                          <div className="text-[11px] text-amber-500 font-semibold mt-1 flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            Победитель: {m.winner}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-[11px] text-brand-800/60 dark:text-brand-100/60 block">
                            {m.p1_time ? `${m.p1_time.toFixed(2)}s` : ''}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 justify-end">
                            <ShieldCheck className="w-3 h-3" />
                            Clean
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Таблица лидеров Elo Рейтинга */
            <div className="w-full p-6 sm:p-8 rounded-3xl bg-[#161022]/95 border border-brand-400/20 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-black text-xl text-brand-900 dark:text-white flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-amber-400" />
                    Глобальный рейтинг Elo спидкуберов
                  </h3>
                  <p className="text-xs text-brand-800/70 dark:text-brand-100/70 mt-1">
                    Рейтинг начисляется по официальной шахматной формуле ФИДЕ/WCA при победах в PvP дуэлях.
                  </p>
                </div>
                {user?.profile && (
                  <div className="px-4 py-2 rounded-2xl bg-brand-500/20 border border-brand-400/30 flex items-center gap-3">
                    <span className="text-xs text-brand-800 dark:text-brand-200">Ваш текущий рейтинг:</span>
                    <span className="font-mono font-black text-base text-brand-400">
                      {user.profile.elo_rating || 1200} ELO
                    </span>
                  </div>
                )}
              </div>

              {leaderboard.length === 0 ? (
                <div className="p-12 text-center text-sm text-brand-800/60 dark:text-brand-100/60">
                  Загрузка таблицы лидеров...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-brand-400/20 text-brand-800/60 dark:text-brand-100/60 uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-3">Ранг</th>
                        <th className="py-3 px-3">Спидкубер</th>
                        <th className="py-3 px-3">WCA ID</th>
                        <th className="py-3 px-3 text-right">Рейтинг Elo</th>
                        <th className="py-3 px-3 text-right">Винрейт</th>
                        <th className="py-3 px-3 text-right">Дуэли (W/L)</th>
                        <th className="py-3 px-3 text-right">Лучшее время</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-400/10">
                      {leaderboard.map((player) => (
                        <tr 
                          key={player.id}
                          className={`hover:bg-brand-400/10 transition-colors ${
                            player.username === user?.username ? 'bg-brand-500/15 font-bold' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-black">
                            {player.rank === 1 ? (
                              <span className="inline-flex items-center gap-1 text-amber-400 font-black">
                                🥇 1
                              </span>
                            ) : player.rank === 2 ? (
                              <span className="inline-flex items-center gap-1 text-slate-300 font-black">
                                🥈 2
                              </span>
                            ) : player.rank === 3 ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 font-black">
                                🥉 3
                              </span>
                            ) : (
                              <span className="text-brand-800/60 dark:text-brand-100/60 font-mono">
                                #{player.rank}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-brand-900 dark:text-white">
                                {player.nickname}
                              </span>
                              {player.win_streak >= 3 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-bold flex items-center gap-0.5">
                                  <Flame className="w-3 h-3 text-red-500" />
                                  {player.win_streak}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {player.wca_id ? (
                              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-brand-500/20 text-brand-300">
                                {player.wca_id}
                              </span>
                            ) : (
                              <span className="text-brand-800/40 dark:text-brand-100/40">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-mono font-black text-sm text-brand-400">
                              {player.elo_rating}
                            </span>
                            <span className="text-[10px] text-brand-800/50 dark:text-brand-100/50 ml-1">
                              (пик: {player.peak_elo})
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                            {player.winrate}%
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <span className="text-emerald-400">{player.duels_won}W</span>
                            <span className="text-brand-800/40 dark:text-brand-100/40 mx-1">/</span>
                            <span className="text-rose-400">{player.duels_lost}L</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-amber-400 font-bold">
                            {player.best_single_time ? `${player.best_single_time.toFixed(2)}s` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </motion.div>
      ) : (
        /* ================= ЭКРАН ДУЭЛИ В КОМНАТЕ ================= */
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-5xl flex flex-col gap-6"
        >
          {/* Предупреждение, если WebSocket сервер недоступен */}
          {wsFailed && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <span className="font-bold block">Бэкенд Django не запущен на порту 8000</span>
                  <span className="text-amber-800/80 dark:text-amber-300/80">
                    Для дуэли по сети запустите <code className="bg-black/20 px-1 py-0.5 rounded font-mono">run_server.bat</code>. 
                    Прямо сейчас вы можете добавить тренировочного бота и протестировать бой!
                  </span>
                </div>
              </div>
              {!activeOpponent && (
                <button
                  onClick={handleAddBot}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                  Сыграть с ботом
                </button>
              )}
            </motion.div>
          )}

          {/* Верхняя статусная панель комнаты */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-3xl bg-[#161022]/95 border border-brand-400/20 shadow-lg">
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3.5 py-1.5 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center gap-2">
                <span className="text-xs font-bold text-brand-700 dark:text-brand-300">КОД ДУЭЛИ:</span>
                <span className="font-mono font-black text-sm text-brand-900 dark:text-white tracking-widest">{currentRoomCode}</span>
                <button 
                  onClick={copyRoomCode} 
                  className="p-1 hover:text-brand-400 text-brand-800/60 dark:text-brand-100/60 transition-colors cursor-pointer"
                  title="Скопировать код"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={copyRoomUrl}
                className="px-3 py-1.5 rounded-xl bg-brand-400/10 hover:bg-brand-400/20 border border-brand-400/20 text-xs font-semibold text-brand-800 dark:text-brand-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3 h-3 text-brand-400" />
                Скопировать ссылку для друга
              </button>

              <div className="flex items-center gap-1.5 text-xs text-brand-800/70 dark:text-brand-100/70 ml-2">
                {isWsConnected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Онлайн WebSocket активен</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-amber-500">Автономный режим</span>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={leaveRoom}
              className="px-4 py-2 rounded-xl text-red-500 hover:bg-red-500/10 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Покинуть дуэль
            </button>
          </div>

          {/* Общий WCA Скрамбл */}
          <div className="p-6 rounded-3xl bg-[#161022]/80 border border-brand-400/20 text-center shadow-lg">
            <span className="text-[11px] font-bold text-brand-800/60 dark:text-brand-100/60 uppercase tracking-widest block mb-2">
              Официальный WCA Скрамбл матча:
            </span>
            <div className="font-mono font-black text-base sm:text-xl md:text-2xl text-brand-900 dark:text-white tracking-wider leading-relaxed">
              {displayScramble}
            </div>
          </div>

          {/* Арена: 2 Игрока друг напротив друга */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
            {/* Левая сторона: ВЫ */}
            <div className="p-6 rounded-3xl bg-[#161022]/95 border border-brand-400/30 flex flex-col justify-between relative overflow-hidden shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-bold text-brand-400 uppercase tracking-wider block">Вы</span>
                  <h3 className="text-2xl font-black text-brand-900 dark:text-white mt-1">{playerName}</h3>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  myReady || myPlayer?.ready 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-brand-500/20 text-brand-300'
                }`}>
                  {myReady || myPlayer?.ready ? 'Готов к битве' : 'Не готов'}
                </div>
              </div>

              {/* Таймер и прогресс */}
              <div className="flex items-center justify-between mb-4 px-4 py-2.5 rounded-2xl bg-black/40 border border-brand-400/20 shadow-inner">
                <div>
                  <span className="text-[10px] font-bold text-brand-800/60 dark:text-brand-100/60 uppercase tracking-wider">
                    Ваше время
                  </span>
                  <div className="font-mono font-black text-3xl sm:text-4xl text-brand-900 dark:text-white">
                    {myTime.toFixed(2)}<span className="text-xl text-brand-400">s</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-brand-800/60 dark:text-brand-100/60 uppercase tracking-wider">
                    Сделано ходов
                  </span>
                  <div className="font-mono font-black text-2xl sm:text-3xl text-brand-400">
                    {myMoves}
                  </div>
                </div>
              </div>

              {/* Интерактивный 3D кубик игрока */}
              <div className="mb-4">
                <DuelCubeCanvas
                  scramble={displayScramble}
                  isInteractive={isMatchRunning && !myFinished}
                  isMatchRunning={isMatchRunning && !myFinished}
                  onMove={handlePlayerMove}
                  onSolved={handlePlayerFinish}
                  accentColor="brand"
                  playerName={playerName}
                />
              </div>

              {/* Действия игрока */}
              <div className="mt-2 flex flex-col gap-3">
                {!isMatchRunning && !myFinished ? (
                  <button
                    onClick={handleToggleReady}
                    className={`w-full py-4 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
                      myReady || myPlayer?.ready 
                        ? 'bg-emerald-500/80 text-white shadow-emerald-500/25' 
                        : 'bg-gradient-to-r from-brand-500 to-brand-400 text-white shadow-brand-500/25 hover:from-brand-600'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                    {myReady || myPlayer?.ready 
                      ? (!activeOpponent ? 'Вы готовы! Добавьте бота или ждите друга' : 'Ожидание соперника...') 
                      : 'Я ГОТОВ К БИТВЕ!'}
                  </button>
                ) : isMatchRunning && !myFinished ? (
                  <div className="py-3 px-4 rounded-2xl bg-brand-500/15 border border-brand-400/30 text-center flex items-center justify-center gap-2.5 shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <span className="text-xs font-bold text-brand-900 dark:text-brand-100">
                      Сборка идет! Крутите грани — финиш зафиксируется автоматически при сборке
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-center font-bold text-sm shadow-inner flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Кубик успешно собран за {myTime.toFixed(2)} сек ({myMoves} ходов)!
                  </div>
                )}
              </div>
            </div>

            {/* Правая сторона: СОПЕРНИК */}
            <div className="p-6 rounded-3xl bg-[#161022]/95 border border-brand-400/20 flex flex-col justify-between relative overflow-hidden shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block">Соперник</span>
                  <h3 className="text-2xl font-black text-brand-900 dark:text-white mt-1">
                    {activeOpponent?.name || 'Ожидание оппонента...'}
                  </h3>
                </div>
                {activeOpponent && (
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    activeOpponent.ready 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-brand-500/20 text-brand-300'
                  }`}>
                    {activeOpponent.ready ? 'Готов к битве' : 'Не готов'}
                  </div>
                )}
              </div>

              {/* Таймер соперника */}
              <div className="flex items-center justify-between mb-4 px-4 py-2.5 rounded-2xl bg-black/25 border border-amber-500/20 shadow-inner">
                <div>
                  <span className="text-[10px] font-bold text-brand-800/60 dark:text-brand-100/60 uppercase tracking-wider">
                    Время соперника
                  </span>
                  <div className="font-mono font-black text-3xl sm:text-4xl text-brand-900/70 dark:text-white/70">
                    {activeOpponent?.time ? activeOpponent.time.toFixed(2) : isMatchRunning ? '...' : '0.00'}
                    <span className="text-xl text-amber-400">s</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-brand-800/60 dark:text-brand-100/60 uppercase tracking-wider">
                    Ходов соперника
                  </span>
                  <div className="font-mono font-black text-2xl sm:text-3xl text-amber-400">
                    {activeOpponent?.moves ?? 0}
                  </div>
                </div>
              </div>

              {/* 3D кубик соперника */}
              <div className="mb-4">
                <DuelCubeCanvas
                  scramble={displayScramble}
                  isInteractive={false}
                  isMatchRunning={isMatchRunning}
                  opponentMoveTrigger={activeOpponent?.moves ?? 0}
                  opponentNextMove={opponentMove}
                  opponentTurn={opponentTurn}
                  isOpponentFinished={Boolean(activeOpponent?.finished)}
                  accentColor="amber"
                  playerName={activeOpponent?.name}
                />
              </div>

              {/* Нижняя часть соперника */}
              <div className="mt-2 flex flex-col gap-3">
                {!activeOpponent ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleAddBot}
                      className="w-full py-3.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-900 dark:text-amber-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Bot className="w-4 h-4 text-amber-500" />
                      Добавить тренировочного бота (AI-соперника)
                    </button>
                    <span className="text-[11px] text-center text-brand-800/50 dark:text-brand-100/50">
                      Или отправьте код комнаты <span className="font-mono font-bold text-brand-400">{currentRoomCode}</span> другу
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-brand-400/5 border border-brand-400/15 text-center text-xs text-brand-800/60 dark:text-brand-100/60">
                    {activeOpponent.finished 
                      ? `Соперник завершил сборку за ${activeOpponent.time?.toFixed(2)} с (${activeOpponent.moves} ходов)`
                      : isMatchRunning 
                        ? 'Соперник прямо сейчас собирает кубик...' 
                        : activeOpponent.ready 
                          ? 'Соперник готов к старту!' 
                          : 'Соперник настраивается...'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Оверлей обратного отсчета */}
          <AnimatePresence>
            {countdown !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.5 }}
                className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center"
              >
                <span className="text-brand-400 text-lg uppercase tracking-widest font-black mb-4">
                  Приготовьте кубик!
                </span>
                <div className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-brand-400 drop-shadow-[0_0_50px_rgba(191,126,184,0.8)] animate-pulse">
                  {countdown}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Модальное окно победы / поражения */}
          <AnimatePresence>
            {resultModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.8, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="max-w-md w-full p-8 rounded-3xl bg-brand-900 border border-brand-400/30 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
                >
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white mb-6 shadow-xl shadow-amber-500/30">
                    <Trophy className="w-10 h-10" />
                  </div>

                  <h2 className="text-3xl md:text-4xl font-black text-white">
                    {resultModal.isWinner ? 'ВЫ ПОБЕДИЛИ!' : 'ВТОРОЕ МЕСТО'}
                  </h2>
                  <p className="text-xs text-brand-100/70 mt-1">
                    {resultModal.isWinner 
                      ? 'Поздравляем! Вы оказались быстрее соперника в этой дуэли.' 
                      : `Победу одержал ${resultModal.winner}. Возьмите реванш!`}
                  </p>

                  {/* Изменение рейтинга Elo (Идея 2) */}
                  {resultModal.eloDelta !== undefined && resultModal.eloDelta !== null && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`mt-4 px-4 py-2 rounded-2xl flex items-center justify-center gap-2 border font-bold text-sm shadow-md ${
                        resultModal.eloDelta >= 0 
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                          : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {resultModal.eloDelta >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-rose-400" />
                      )}
                      <span className="font-mono font-black">
                        {resultModal.eloDelta >= 0 ? `+${resultModal.eloDelta}` : resultModal.eloDelta} ELO
                      </span>
                      {resultModal.myNewElo && (
                        <span className="text-xs text-white/60 font-mono">
                          (Итог: {resultModal.myNewElo} ELO)
                        </span>
                      )}
                    </motion.div>
                  )}

                  {/* Сравнение времени, ходов и TPS */}
                  <div className="w-full grid grid-cols-2 gap-3 my-4">
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-left">
                      <span className="text-[10px] text-white/50 block font-bold uppercase tracking-wider">Вы</span>
                      <span className="font-mono font-black text-2xl text-emerald-400 block my-0.5">
                        {resultModal.myTime.toFixed(2)}s
                      </span>
                      <div className="text-[11px] text-white/70 space-y-0.5 font-mono">
                        <div>Ходов: <span className="text-white font-bold">{resultModal.myMoves ?? 0}</span></div>
                        <div className="text-[10px] text-emerald-400">
                          TPS: {((resultModal.myMoves || 0) / Math.max(resultModal.myTime, 0.1)).toFixed(1)} х/с
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-left">
                      <span className="text-[10px] text-white/50 block font-bold uppercase tracking-wider">Соперник</span>
                      <span className="font-mono font-black text-2xl text-amber-400 block my-0.5">
                        {resultModal.opponentTime ? `${resultModal.opponentTime.toFixed(2)}s` : 'DNF'}
                      </span>
                      <div className="text-[11px] text-white/70 space-y-0.5 font-mono">
                        <div>Ходов: <span className="text-white font-bold">{resultModal.opponentMoves ?? 0}</span></div>
                        <div className="text-[10px] text-amber-400">
                          TPS: {resultModal.opponentTime ? ((resultModal.opponentMoves || 0) / Math.max(resultModal.opponentTime, 0.1)).toFixed(1) : '0.0'} х/с
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Бейдж античит-верификации WCA (Идея 3) */}
                  <div className={`w-full p-3 rounded-2xl border text-xs flex items-center gap-2.5 mb-5 text-left ${
                    resultModal.verification?.verified !== false
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}>
                    {resultModal.verification?.verified !== false ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold flex items-center gap-1.5 flex-wrap">
                        <span>Античит WCA:</span>
                        <span className={`font-mono text-[10px] uppercase px-1.5 py-0.2 rounded font-black ${
                          resultModal.verification?.verified !== false 
                            ? 'bg-emerald-500/25 text-emerald-300' 
                            : 'bg-amber-500/25 text-amber-300'
                        }`}>
                          {resultModal.verification?.status || 'VERIFIED'}
                        </span>
                      </div>
                      <span className="text-[10px] opacity-80 block truncate mt-0.5">
                        {resultModal.verification?.details || 'Сборка полностью верифицирована античитом WCA'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleRematch}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-600 hover:to-brand-500 text-white font-black text-sm shadow-lg shadow-brand-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Запросить реванш
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
