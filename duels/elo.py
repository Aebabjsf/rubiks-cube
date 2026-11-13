import math

BOT_DEFAULT_ELO = 1250


def get_k_factor(rating: int, total_games: int) -> int:
    """Определяет коэффициент K для формулы Elo в зависимости от опыта игрока."""
    if total_games < 30:
        return 32  # Калибровочные игры
    if rating < 1600:
        return 24  # Основной дивизион
    return 16      # Мастер-дивизион


def calculate_elo_change(
    rating_a: int, 
    rating_b: int, 
    score_a: float, 
    games_a: int = 10, 
    games_b: int = 10
) -> tuple[int, int]:
    """
    Рассчитывает изменение рейтинга Elo для двух игроков по официальной формуле ФИДЕ.
    
    :param rating_a: Рейтинг игрока A
    :param rating_b: Рейтинг игрока B
    :param score_a: 1.0 (победа A), 0.5 (ничья), 0.0 (поражение A / победа B)
    :param games_a: Число сыгранных матчей игрока A
    :param games_b: Число сыгранных матчей игрока B
    :return: Кортеж (изменение рейтинга A, изменение рейтинга B)
    """
    # Математическое ожидание исхода матча
    expected_a = 1.0 / (1.0 + math.pow(10.0, (rating_b - rating_a) / 400.0))
    expected_b = 1.0 - expected_a
    score_b = 1.0 - score_a

    k_a = get_k_factor(rating_a, games_a)
    k_b = get_k_factor(rating_b, games_b)

    delta_a = round(k_a * (score_a - expected_a))
    delta_b = round(k_b * (score_b - expected_b))

    # Гарантируем минимальное изменение рейтинга хотя бы на 1 пункт при победе
    if score_a == 1.0 and delta_a < 1:
        delta_a = 1
        delta_b = -1
    elif score_a == 0.0 and delta_a > -1:
        delta_a = -1
        delta_b = 1

    return delta_a, delta_b
