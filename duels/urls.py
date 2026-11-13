from django.urls import path
from .views import DuelRoomListCreateView, DuelLeaderboardView

urlpatterns = [
    path('duels/rooms/', DuelRoomListCreateView.as_view(), name='duel_rooms'),
    path('duels/create/', DuelRoomListCreateView.as_view(), name='duel_create'),
    path('duels/leaderboard/', DuelLeaderboardView.as_view(), name='duel_leaderboard'),
]
