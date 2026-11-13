from django.urls import re_path, path
from .consumers import DuelConsumer

websocket_urlpatterns = [
    re_path(r'^ws/duel/(?P<room_code>[\w-]+)/?$', DuelConsumer.as_asgi()),
    path('ws/duel/<str:room_code>/', DuelConsumer.as_asgi()),
]
