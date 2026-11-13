import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .utils import generate_wca_scramble
from .elo import calculate_elo_change, BOT_DEFAULT_ELO
from .verifier import verify_solve

# Хранилище комнат в памяти процесса
# ROOMS[room_code] = {
#     'players': { channel_name: { 'id': channel_name, 'name': '...', 'ready': bool, 'time': float, 'moves': int, 'finished': bool, 'is_bot': bool } }
# }
ROOMS = {}

class DuelConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_code = self.scope['url_route']['kwargs']['room_code'].upper()
        self.room_group_name = f'duel_{self.room_code}'
        self.player_name = None

        if self.room_code not in ROOMS:
            ROOMS[self.room_code] = {
                'players': {},
                'scramble': generate_wca_scramble(),
                'status': 'waiting',
                'winner': None,
            }

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # Сразу отправляем текущее состояние комнаты новому клиенту
        room = ROOMS[self.room_code]
        await self.send(text_data=json.dumps({
            'event': 'room_state',
            'room_state': self.get_room_state(room)
        }))

    async def disconnect(self, close_code):
        room = ROOMS.get(self.room_code)
        if room and self.channel_name in room['players']:
            player_info = room['players'].pop(self.channel_name)
            
            # Оповещаем остальных
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': 'player_left',
                    'player_name': player_info['name'],
                    'room_state': self.get_room_state(room)
                }
            )

            # Если живых игроков не осталось, удаляем комнату
            human_players = [p for p in room['players'].values() if not p.get('is_bot')]
            if not human_players:
                ROOMS.pop(self.room_code, None)

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except Exception:
            return

        action = data.get('action')
        room = ROOMS.get(self.room_code)
        if not room:
            return

        if action == 'join':
            raw_name = data.get('player_name', '').strip() or 'Спидкубер'

            # Если в комнате был тренировочный бот, а подключается реальный игрок (по ссылке или коду) —
            # автоматически убираем бота, освобождая слот для живого соперника!
            bot_keys = [ch for ch, p in room['players'].items() if p.get('is_bot')]
            for bk in bot_keys:
                del room['players'][bk]
            
            # Устраняем коллизию одинаковых имен в одной комнате (например, если оба окна открыты как "Спидкубер")
            existing_names = [p['name'] for ch, p in room['players'].items() if ch != self.channel_name]
            player_name = raw_name
            if player_name in existing_names:
                count = 2
                while f"{raw_name} #{count}" in existing_names:
                    count += 1
                player_name = f"{raw_name} #{count}"

            self.player_name = player_name

            # Максимум 2 игрока в дуэли
            if len(room['players']) < 2 or self.channel_name in room['players']:
                room['players'][self.channel_name] = {
                    'id': self.channel_name,
                    'name': player_name,
                    'ready': False,
                    'time': None,
                    'moves': 0,
                    'finished': False,
                    'is_bot': False,
                }

            # Сообщаем клиенту его подтвержденное имя и уникальный идентификатор сессии
            await self.send(text_data=json.dumps({
                'event': 'joined_success',
                'assigned_name': player_name,
                'my_id': self.channel_name,
            }))

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': 'room_state',
                    'room_state': self.get_room_state(room)
                }
            )

        elif action == 'add_bot':
            bot_channel = f"bot_{self.room_code}"
            if bot_channel not in room['players'] and len(room['players']) < 2:
                room['players'][bot_channel] = {
                    'id': bot_channel,
                    'name': 'Бот Speedy3x3 (AI)',
                    'ready': True,
                    'time': None,
                    'moves': 0,
                    'finished': False,
                    'is_bot': True,
                }
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'broadcast_event',
                        'event': 'room_state',
                        'room_state': self.get_room_state(room)
                    }
                )

        elif action == 'ready':
            if self.channel_name in room['players']:
                room['players'][self.channel_name]['ready'] = True
                
                # Бот всегда готов
                for p in room['players'].values():
                    if p.get('is_bot'):
                        p['ready'] = True

                ready_count = sum(1 for p in room['players'].values() if p['ready'])
                if len(room['players']) == 2 and ready_count == 2:
                    room['status'] = 'countdown'
                    room['scramble'] = generate_wca_scramble()
                    room['winner'] = None
                    for p in room['players'].values():
                        p['finished'] = False
                        p['time'] = None
                        p['moves'] = 0

                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'broadcast_event',
                            'event': 'match_starting',
                            'scramble': room['scramble'],
                            'countdown': 3,
                            'room_state': self.get_room_state(room)
                        }
                    )
                else:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'broadcast_event',
                            'event': 'room_state',
                            'room_state': self.get_room_state(room)
                        }
                    )

        elif action == 'progress':
            moves = data.get('moves', 0)
            elapsed_time = data.get('time', 0)
            move_str = data.get('move')
            if self.channel_name in room['players']:
                room['players'][self.channel_name]['moves'] = moves
                room['players'][self.channel_name]['time'] = elapsed_time

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'broadcast_event',
                        'event': 'opponent_progress',
                        'sender': self.player_name,
                        'moves': moves,
                        'time': elapsed_time,
                        'move': move_str
                    }
                )

        elif action == 'bot_progress':
            bot_channel = f"bot_{self.room_code}"
            if bot_channel in room['players']:
                moves = data.get('moves', 0)
                elapsed_time = data.get('time', 0)
                move_str = data.get('move')
                room['players'][bot_channel]['moves'] = moves
                room['players'][bot_channel]['time'] = elapsed_time

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'broadcast_event',
                        'event': 'opponent_progress',
                        'sender': room['players'][bot_channel]['name'],
                        'moves': moves,
                        'time': elapsed_time,
                        'move': move_str
                    }
                )

        elif action == 'bot_finish':
            bot_channel = f"bot_{self.room_code}"
            if bot_channel in room['players']:
                bot_time = data.get('time', 18.0)
                bot_moves = data.get('moves', 35)
                b_data = room['players'][bot_channel]
                b_data['finished'] = True
                b_data['time'] = bot_time
                b_data['moves'] = bot_moves
                v_res = {
                    'verified': True,
                    'status': 'VERIFIED',
                    'tps': round(bot_moves / max(bot_time, 0.01), 2),
                    'details': f'WCA AI Bot Engine (TPS: {round(bot_moves / max(bot_time, 0.01), 2)})'
                }
                b_data['verification'] = v_res

                is_winner = False
                if not room['winner']:
                    room['winner'] = b_data['name']
                    is_winner = True

                all_finished = all(p['finished'] for p in room['players'].values())
                elo_updates = None
                if all_finished:
                    room['status'] = 'finished'
                    elo_updates = await self.save_match_result(room)

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'broadcast_event',
                        'event': 'player_finished',
                        'player_name': b_data['name'],
                        'time': bot_time,
                        'moves': bot_moves,
                        'is_winner': is_winner,
                        'winner': room['winner'],
                        'all_finished': all_finished,
                        'verification': v_res,
                        'elo_updates': elo_updates,
                        'room_state': self.get_room_state(room)
                    }
                )

        elif action == 'finish':
            final_time = data.get('time', 0)
            moves = data.get('moves', 0)

            if self.channel_name in room['players']:
                p_data = room['players'][self.channel_name]
                p_data['finished'] = True
                p_data['time'] = final_time
                p_data['moves'] = moves

                # Античит валидация сборки
                v_res = verify_solve(final_time, moves, room.get('scramble', ''))
                p_data['verification'] = v_res

                is_winner = False
                if not room['winner']:
                    room['winner'] = self.player_name
                    is_winner = True

                all_finished = all(p['finished'] for p in room['players'].values())
                elo_updates = None
                if all_finished:
                    room['status'] = 'finished'
                    elo_updates = await self.save_match_result(room)

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'broadcast_event',
                        'event': 'player_finished',
                        'player_name': self.player_name,
                        'time': final_time,
                        'moves': moves,
                        'is_winner': is_winner,
                        'winner': room['winner'],
                        'all_finished': all_finished,
                        'verification': v_res,
                        'elo_updates': elo_updates,
                        'room_state': self.get_room_state(room)
                    }
                )

        elif action == 'rematch':
            room['status'] = 'waiting'
            room['winner'] = None
            room['scramble'] = generate_wca_scramble()
            for p in room['players'].values():
                p['ready'] = p.get('is_bot', False) # бот готов сразу
                p['finished'] = False
                p['time'] = None
                p['moves'] = 0

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': 'rematch_reset',
                    'room_state': self.get_room_state(room)
                }
            )

    async def broadcast_event(self, event):
        await self.send(text_data=json.dumps(event))

    def get_room_state(self, room):
        players_list = []
        for ch, info in room['players'].items():
            players_list.append({
                'id': ch,
                'name': info['name'],
                'ready': info['ready'],
                'finished': info['finished'],
                'time': info['time'],
                'moves': info['moves'],
                'is_bot': info.get('is_bot', False),
            })
        return {
            'room_code': self.room_code,
            'status': room['status'],
            'scramble': room['scramble'],
            'winner': room['winner'],
            'players': players_list,
        }

    @database_sync_to_async
    def save_match_result(self, room):
        from .models import DuelMatch
        from profiles.models import Profile
        from django.contrib.auth.models import User
        from .elo import calculate_elo_change, BOT_DEFAULT_ELO
        from .verifier import verify_solve

        players = list(room['players'].values())
        if not players:
            return None

        p1_data = players[0]
        p2_data = players[1] if len(players) > 1 else None

        p1_name = p1_data['name']
        p2_name = p2_data['name'] if p2_data else 'AI Bot'
        is_p1_bot = p1_data.get('is_bot', False)
        is_p2_bot = p2_data.get('is_bot', False) if p2_data else True
        is_bot_match = is_p1_bot or is_p2_bot

        p1_time = p1_data.get('time')
        p2_time = p2_data.get('time') if p2_data else None
        p1_moves = p1_data.get('moves', 0)
        p2_moves = p2_data.get('moves', 0) if p2_data else 0

        p1_tps = round(p1_moves / max(p1_time or 1.0, 0.001), 2) if p1_time else 0.0
        p2_tps = round(p2_moves / max(p2_time or 1.0, 0.001), 2) if p2_time else 0.0

        # Античит верификация
        v1 = p1_data.get('verification') or verify_solve(p1_time, p1_moves, room.get('scramble', ''))
        v2 = (p2_data.get('verification') if p2_data else None) or verify_solve(p2_time, p2_moves, room.get('scramble', ''))

        status_v = 'VERIFIED'
        if not v1.get('verified', True):
            status_v = v1.get('status', 'SUSPICIOUS_TPS')
        elif v2 and not v2.get('verified', True):
            status_v = v2.get('status', 'SUSPICIOUS_TPS')

        v_details = f"P1: {v1.get('details', '')} | P2: {v2.get('details', '')}"

        # Поиск профилей
        def find_profile(name, is_bot):
            if is_bot or not name:
                return None, BOT_DEFAULT_ELO
            u = User.objects.filter(username=name).first()
            if u and hasattr(u, 'profile'):
                return u.profile, u.profile.elo_rating
            p = Profile.objects.filter(nickname=name).first()
            if p:
                return p, p.elo_rating
            return None, 1200

        prof1, elo1_before = find_profile(p1_name, is_p1_bot)
        prof2, elo2_before = find_profile(p2_name, is_p2_bot)

        winner = room.get('winner')
        if winner == p1_name:
            score_a = 1.0
        elif winner == p2_name:
            score_a = 0.0
        else:
            if p1_time and p2_time:
                score_a = 1.0 if p1_time < p2_time else (0.5 if p1_time == p2_time else 0.0)
            else:
                score_a = 0.5

        games1 = prof1.total_duels if prof1 else 10
        games2 = prof2.total_duels if prof2 else 10

        d1, d2 = calculate_elo_change(elo1_before, elo2_before, score_a, games1, games2)

        # Обновляем профиль P1
        elo1_after = max(100, elo1_before + d1)
        if prof1:
            prof1.elo_rating = elo1_after
            prof1.peak_elo = max(prof1.peak_elo, elo1_after)
            if score_a == 1.0:
                prof1.duels_won += 1
                prof1.win_streak += 1
                prof1.best_win_streak = max(prof1.best_win_streak, prof1.win_streak)
            elif score_a == 0.0:
                prof1.duels_lost += 1
                prof1.win_streak = 0
            if p1_time and (prof1.best_single_time is None or p1_time < prof1.best_single_time):
                prof1.best_single_time = round(p1_time, 2)
            prof1.save()

        # Обновляем профиль P2
        elo2_after = max(100, elo2_before + d2)
        if prof2:
            prof2.elo_rating = elo2_after
            prof2.peak_elo = max(prof2.peak_elo, elo2_after)
            if score_a == 0.0:
                prof2.duels_won += 1
                prof2.win_streak += 1
                prof2.best_win_streak = max(prof2.best_win_streak, prof2.win_streak)
            elif score_a == 1.0:
                prof2.duels_lost += 1
                prof2.win_streak = 0
            if p2_time and (prof2.best_single_time is None or p2_time < prof2.best_single_time):
                prof2.best_single_time = round(p2_time, 2)
            prof2.save()

        # Сохранение в DuelMatch
        p1_user = prof1.user if prof1 else None
        p2_user = prof2.user if prof2 else None

        DuelMatch.objects.update_or_create(
            room_code=self.room_code,
            defaults={
                'player1': p1_user,
                'player2': p2_user,
                'player1_name': p1_name,
                'player2_name': p2_name,
                'scramble': room.get('scramble', ''),
                'player1_time': p1_time,
                'player2_time': p2_time,
                'player1_moves': p1_moves,
                'player2_moves': p2_moves,
                'player1_tps': p1_tps,
                'player2_tps': p2_tps,
                'p1_elo_before': elo1_before,
                'p1_elo_after': elo1_after,
                'p2_elo_before': elo2_before,
                'p2_elo_after': elo2_after,
                'verification_status': status_v,
                'verification_details': v_details,
                'is_bot_match': is_bot_match,
                'winner_name': winner or '',
                'status': 'finished'
            }
        )

        return {
            'p1': {
                'name': p1_name,
                'elo_before': elo1_before,
                'elo_after': elo1_after,
                'delta': d1,
                'tps': p1_tps,
                'verification': v1
            },
            'p2': {
                'name': p2_name,
                'elo_before': elo2_before,
                'elo_after': elo2_after,
                'delta': d2,
                'tps': p2_tps,
                'verification': v2
            }
        }
