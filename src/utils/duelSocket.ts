// rubiks-cube/src/utils/duelSocket.ts

export interface DuelPlayer {
  id?: string;
  name: string;
  ready: boolean;
  finished: boolean;
  time: number | null;
  moves: number;
  is_bot?: boolean;
}

export interface DuelRoomState {
  room_code: string;
  status: 'waiting' | 'countdown' | 'in_progress' | 'finished';
  scramble: string;
  winner: string | null;
  players: DuelPlayer[];
}

export interface DuelSocketCallbacks {
  onRoomState?: (state: DuelRoomState) => void;
  onJoinedSuccess?: (data: { assigned_name: string; my_id?: string }) => void;
  onMatchStarting?: (data: { scramble: string; countdown: number; room_state: DuelRoomState }) => void;
  onOpponentProgress?: (data: { sender: string; moves: number; time: number; move?: string }) => void;
  onPlayerFinished?: (data: { 
    player_name: string; 
    time: number; 
    moves: number; 
    is_winner: boolean; 
    winner: string; 
    all_finished: boolean; 
    verification?: {
      verified: boolean;
      status: string;
      tps: number;
      details: string;
    };
    elo_updates?: {
      p1: { name: string; elo_before: number; elo_after: number; delta: number; tps: number; verification: any };
      p2: { name: string; elo_before: number; elo_after: number; delta: number; tps: number; verification: any };
    };
    room_state: DuelRoomState;
  }) => void;
  onPlayerLeft?: (data: { player_name: string; room_state: DuelRoomState }) => void;
  onRematchReset?: (data: { room_state: DuelRoomState }) => void;
  onConnected?: () => void;
  onError?: (err: Event) => void;
  onClose?: () => void;
}

export class DuelSocketClient {
  private ws: WebSocket | null = null;
  private roomCode: string;
  private callbacks: DuelSocketCallbacks;

  constructor(roomCode: string, callbacks: DuelSocketCallbacks) {
    this.roomCode = roomCode.toUpperCase();
    this.callbacks = callbacks;
  }

  connect(playerName: string) {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const wsProto = isHttps ? 'wss:' : 'ws:';
    // Интеллектуальный выбор хоста: используем текущий hostname браузера (localhost, 127.0.0.1 или локальный IP)
    const hostname = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
    const host = import.meta.env.VITE_WS_HOST || `${hostname}:8000`;
    const url = `${wsProto}//${host}/ws/duel/${this.roomCode}/`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.callbacks.onConnected?.();
      this.sendJoin(playerName);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventType = data.event;

        if (eventType === 'room_state') {
          this.callbacks.onRoomState?.(data.room_state);
        } else if (eventType === 'joined_success') {
          this.callbacks.onJoinedSuccess?.(data);
        } else if (eventType === 'match_starting') {
          this.callbacks.onMatchStarting?.(data);
        } else if (eventType === 'opponent_progress') {
          this.callbacks.onOpponentProgress?.(data);
        } else if (eventType === 'player_finished') {
          this.callbacks.onPlayerFinished?.(data);
        } else if (eventType === 'player_left') {
          this.callbacks.onPlayerLeft?.(data);
        } else if (eventType === 'rematch_reset') {
          this.callbacks.onRematchReset?.(data);
        }
      } catch (e) {
        console.error('WebSocket parse error:', e);
      }
    };

    this.ws.onerror = (e) => {
      this.callbacks.onError?.(e);
    };

    this.ws.onclose = () => {
      this.callbacks.onClose?.();
    };
  }

  sendJoin(playerName: string) {
    this.send({ action: 'join', player_name: playerName });
  }

  sendAddBot() {
    this.send({ action: 'add_bot' });
  }

  sendReady() {
    this.send({ action: 'ready' });
  }

  sendProgress(moves: number, time: number, move?: string) {
    this.send({ action: 'progress', moves, time, move });
  }

  sendFinish(time: number, moves: number) {
    this.send({ action: 'finish', time, moves });
  }

  sendBotProgress(moves: number, time: number, move?: string) {
    this.send({ action: 'bot_progress', moves, time, move });
  }

  sendBotFinish(time: number, moves: number) {
    this.send({ action: 'bot_finish', time, moves });
  }

  sendRematch() {
    this.send({ action: 'rematch' });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private send(data: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
