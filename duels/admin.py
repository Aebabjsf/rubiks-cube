from django.contrib import admin
from .models import DuelMatch


@admin.register(DuelMatch)
class DuelMatchAdmin(admin.ModelAdmin):
    list_display = ('room_code', 'player1_name', 'player2_name', 'winner_name', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('room_code', 'player1_name', 'player2_name', 'winner_name')
