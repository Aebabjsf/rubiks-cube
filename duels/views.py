import random
import string
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from profiles.models import Profile
from .models import DuelMatch
from .utils import generate_wca_scramble
from .consumers import ROOMS


def generate_room_code():
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(6))


class DuelRoomListCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        active_rooms = []
        for code, data in ROOMS.items():
            active_rooms.append({
                'code': code,
                'players_count': len(data['players']),
                'status': data['status'],
                'players': [p['name'] for p in data['players'].values()],
            })

        recent_matches = DuelMatch.objects.filter(status='finished').order_by('-created_at')[:8]
        matches_data = [
            {
                'code': m.room_code,
                'p1': m.player1_name,
                'p2': m.player2_name,
                'winner': m.winner_name,
                'p1_time': m.player1_time,
                'p2_time': m.player2_time,
                'p1_elo_after': m.p1_elo_after,
                'p2_elo_after': m.p2_elo_after,
                'verification_status': m.verification_status,
                'date': m.created_at.strftime('%d.%m %H:%M')
            }
            for m in recent_matches
        ]

        return Response({
            'active_rooms': active_rooms,
            'recent_matches': matches_data,
        })

    def post(self, request):
        room_code = generate_room_code()
        while room_code in ROOMS:
            room_code = generate_room_code()

        scramble = generate_wca_scramble()
        ROOMS[room_code] = {
            'players': {},
            'scramble': scramble,
            'status': 'waiting',
            'winner': None,
        }

        return Response({
            'room_code': room_code,
            'scramble': scramble,
            'message': f'Комната {room_code} успешно создана!'
        }, status=status.HTTP_201_CREATED)


class DuelLeaderboardView(APIView):
    """Глобальная рейтинговая таблица лидеров спидкубинга (Elo PvP)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # Получаем топ 50 профилей по рейтингу Elo
        profiles = Profile.objects.select_related('user').order_by(
            '-elo_rating', 
            '-duels_won', 
            'best_single_time'
        )[:50]

        leaderboard = []
        for idx, p in enumerate(profiles, start=1):
            leaderboard.append({
                'rank': idx,
                'id': p.id,
                'username': p.user.username,
                'nickname': p.nickname or p.user.username,
                'avatar': p.avatar.url if p.avatar else None,
                'wca_id': p.wca_id or None,
                'elo_rating': p.elo_rating,
                'peak_elo': p.peak_elo,
                'duels_won': p.duels_won,
                'duels_lost': p.duels_lost,
                'total_duels': p.total_duels,
                'winrate': p.winrate,
                'win_streak': p.win_streak,
                'best_win_streak': p.best_win_streak,
                'best_single_time': p.best_single_time,
            })

        return Response({
            'leaderboard': leaderboard,
            'total_players': Profile.objects.count(),
        })
