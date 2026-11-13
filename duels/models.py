from django.db import models
from django.contrib.auth.models import User
from .utils import generate_wca_scramble


class DuelMatch(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'Ожидание соперника'),
        ('in_progress', 'Идет сборка'),
        ('finished', 'Матч завершен'),
    ]

    room_code = models.CharField(max_length=20, unique=True, verbose_name="Код комнаты")
    player1 = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='duels_as_p1')
    player2 = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='duels_as_p2')
    
    player1_name = models.CharField(max_length=100, verbose_name="Имя игрока 1")
    player2_name = models.CharField(max_length=100, blank=True, default="", verbose_name="Имя игрока 2")

    scramble = models.TextField(verbose_name="Скрамбл матча", default=generate_wca_scramble)
    
    player1_time = models.FloatField(null=True, blank=True, verbose_name="Время игрока 1 (сек)")
    player2_time = models.FloatField(null=True, blank=True, verbose_name="Время игрока 2 (сек)")
    
    player1_moves = models.IntegerField(default=0, verbose_name="Ходов игрока 1")
    player2_moves = models.IntegerField(default=0, verbose_name="Ходов игрока 2")

    player1_tps = models.FloatField(null=True, blank=True, verbose_name="TPS игрока 1")
    player2_tps = models.FloatField(null=True, blank=True, verbose_name="TPS игрока 2")

    # Изменение рейтинга Elo участников
    p1_elo_before = models.IntegerField(null=True, blank=True, verbose_name="Рейтинг P1 до матча")
    p1_elo_after = models.IntegerField(null=True, blank=True, verbose_name="Рейтинг P1 после матча")
    p2_elo_before = models.IntegerField(null=True, blank=True, verbose_name="Рейтинг P2 до матча")
    p2_elo_after = models.IntegerField(null=True, blank=True, verbose_name="Рейтинг P2 после матча")

    # Античит-валидация сборки
    VERIFY_CHOICES = [
        ('VERIFIED', 'Верифицировано античитом (Clean)'),
        ('SUSPICIOUS_TPS', 'Подозрительно высокий TPS'),
        ('IMPOSSIBLE_TIME', 'Нереалистично быстрое время (< 2.5 с)'),
        ('TOO_FEW_MOVES', 'Слишком мало ходов для решения'),
    ]
    verification_status = models.CharField(
        max_length=30, 
        choices=VERIFY_CHOICES, 
        default='VERIFIED', 
        verbose_name="Статус античита"
    )
    verification_details = models.TextField(blank=True, default="", verbose_name="Отчет античита")
    is_bot_match = models.BooleanField(default=False, verbose_name="Матч с AI-ботом")
    
    winner_name = models.CharField(max_length=100, blank=True, default="", verbose_name="Победитель")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting', verbose_name="Статус")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Последнее обновление")

    class Meta:
        verbose_name = "Онлайн-дуэль"
        verbose_name_plural = "Онлайн-дуэли"
        ordering = ['-created_at']

    def __str__(self):
        return f"Дуэль {self.room_code}: {self.player1_name} vs {self.player2_name or '?'}"
