import re
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Profile, UserSettings


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id',
            'username',
            'email',
            'nickname',
            'avatar',
            'bio',
            'wca_id',
            'favorite_puzzle',
            'elo_rating',
            'peak_elo',
            'duels_won',
            'duels_lost',
            'win_streak',
            'best_win_streak',
            'best_single_time',
            'total_duels',
            'winrate',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 
            'username', 
            'email', 
            'elo_rating', 
            'peak_elo', 
            'duels_won', 
            'duels_lost', 
            'win_streak', 
            'best_win_streak', 
            'best_single_time', 
            'total_duels', 
            'winrate', 
            'created_at', 
            'updated_at'
        ]

    def validate_wca_id(self, value):
        if value:
            # WCA ID формат: 4 цифры года + 4 латинские буквы фамилии/имени + 2 цифры (например, 2018PARK01)
            pattern = r'^\d{4}[A-Za-z]{4}\d{2}$'
            if not re.match(pattern, value):
                raise serializers.ValidationError("Неверный формат WCA ID. Пример корректного: 2018PARK01 (год + 4 буквы + 2 цифры).")
            return value.upper()
        return value


class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = [
            'theme',
            'cube_sensitivity',
            'sound_enabled',
            'custom_colors',
            'keybindings',
            'updated_at',
        ]
        read_only_fields = ['updated_at']

    def validate_cube_sensitivity(self, value):
        if value < 0.1 or value > 5.0:
            raise serializers.ValidationError("Чувствительность должна быть в диапазоне от 0.1 до 5.0")
        return value

    def validate_custom_colors(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("custom_colors должен быть словарем цветов для граней U, D, F, B, L, R")
        valid_hex = re.compile(r'^#(?:[0-9a-fA-F]{3}){1,2}$')
        for face, hex_color in value.items():
            if not isinstance(hex_color, str) or not valid_hex.match(hex_color):
                raise serializers.ValidationError(f"Цвет для грани {face} должен быть валидным HEX (например, #FF5800)")
        return value


class UserDetailSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    settings = UserSettingsSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile', 'settings']
        read_only_fields = ['id', 'username', 'email']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True)
    nickname = serializers.CharField(required=False, allow_blank=True)
    wca_id = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'nickname', 'wca_id']

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Пользователь с таким логином уже существует.")
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Пользователь с таким email уже зарегистрирован.")
        return value

    def validate(self, attrs):
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({"password_confirm": "Пароли не совпадают."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        nickname = validated_data.pop('nickname', '')
        wca_id = validated_data.pop('wca_id', '')
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        
        # Обновляем профиль данными, если они были переданы при регистрации
        if nickname or wca_id:
            profile = user.profile
            if nickname:
                profile.nickname = nickname
            if wca_id:
                profile.wca_id = wca_id.upper()
            profile.save()
            
        return user
