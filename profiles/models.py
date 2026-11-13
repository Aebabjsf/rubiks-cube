from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


def default_cube_colors():
    """Стандартная WCA расцветка кубика Рубика (BOY - Blue Orange Yellow / White Green Red)."""
    return {
        "U": "#FFFFFF",  # Вверх: Белый
        "D": "#FFD500",  # Низ: Желтый
        "F": "#009B48",  # Перед: Зеленый
        "B": "#0046AD",  # Зад: Синий
        "L": "#FF5800",  # Лево: Оранжевый
        "R": "#B71234",  # Право: Красный
    }


def default_keybindings():
    """Стандартные привязки клавиш для вращения кубика в симуляторе."""
    return {
        "U": "u",
        "U_prime": "U",
        "D": "d",
        "D_prime": "D",
        "R": "r",
        "R_prime": "R",
        "L": "l",
        "L_prime": "L",
        "F": "f",
        "F_prime": "F",
        "B": "b",
        "B_prime": "B",
        "M": "m",
        "M_prime": "M"
    }


class Profile(models.Model):
    """Профиль спидкубера с персональными данными и статистикой."""
    
    PUZZLE_CHOICES = [
        ('3x3', 'Кубик 3x3'),
        ('2x2', 'Кубик 2x2'),
        ('pyraminx', 'Пирамидка Мефферта'),
        ('4x4', 'Кубик 4x4'),
        ('megaminx', 'Мегаминкс'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    nickname = models.CharField(max_length=50, blank=True, verbose_name="Отображаемое имя / Никнейм")
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name="Аватар")
    bio = models.TextField(max_length=500, blank=True, verbose_name="О себе")
    wca_id = models.CharField(
        max_length=10, 
        blank=True, 
        verbose_name="WCA ID",
        help_text="Официальный ID участника WCA (например, 2018PARK01)"
    )
    favorite_puzzle = models.CharField(
        max_length=20, 
        choices=PUZZLE_CHOICES, 
        default='3x3', 
        verbose_name="Любимая дисциплина"
    )

    # Соревновательный рейтинг и статистика дуэлей (Идея 2)
    elo_rating = models.IntegerField(default=1200, verbose_name="Рейтинг Elo (PvP)")
    peak_elo = models.IntegerField(default=1200, verbose_name="Пиковый рейтинг Elo")
    duels_won = models.PositiveIntegerField(default=0, verbose_name="Побед в дуэлях")
    duels_lost = models.PositiveIntegerField(default=0, verbose_name="Поражений в дуэлях")
    win_streak = models.PositiveIntegerField(default=0, verbose_name="Текущая серия побед")
    best_win_streak = models.PositiveIntegerField(default=0, verbose_name="Рекордная серия побед")
    best_single_time = models.FloatField(null=True, blank=True, verbose_name="Лучшее время сборки (сек)")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата регистрации")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Последнее обновление")

    @property
    def total_duels(self):
        return self.duels_won + self.duels_lost

    @property
    def winrate(self):
        if self.total_duels == 0:
            return 0.0
        return round((self.duels_won / self.total_duels) * 100, 1)

    class Meta:
        verbose_name = "Профиль спидкубера"
        verbose_name_plural = "Профили спидкуберов"

    def __str__(self):
        return f"{self.nickname or self.user.username} ({self.user.username})"


class UserSettings(models.Model):
    """Синхронизируемые пользовательские настройки симулятора и интерфейса."""
    
    THEME_CHOICES = [
        ('dark', 'Темная тема'),
        ('light', 'Светлая тема'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='settings')
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default='dark', verbose_name="Тема интерфейса")
    cube_sensitivity = models.FloatField(default=1.0, verbose_name="Чувствительность вращения кубика")
    sound_enabled = models.BooleanField(default=True, verbose_name="Звуки вращения граней")
    custom_colors = models.JSONField(default=default_cube_colors, blank=True, verbose_name="Кастомные цвета граней")
    keybindings = models.JSONField(default=default_keybindings, blank=True, verbose_name="Раскладка горячих клавиш")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления настроек")

    class Meta:
        verbose_name = "Настройки пользователя"
        verbose_name_plural = "Настройки пользователей"

    def __str__(self):
        return f"Настройки для {self.user.username}"


# Автоматическое создание профиля и настроек при создании пользователя
@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(
            user=instance,
            nickname=instance.username
        )
        UserSettings.objects.create(user=instance)
