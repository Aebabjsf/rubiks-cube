from django.contrib import admin
from .models import Profile, UserSettings


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'nickname', 'wca_id', 'favorite_puzzle', 'created_at')
    search_fields = ('user__username', 'nickname', 'wca_id')
    list_filter = ('favorite_puzzle', 'created_at')


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ('user', 'theme', 'cube_sensitivity', 'sound_enabled', 'updated_at')
    list_filter = ('theme', 'sound_enabled')
