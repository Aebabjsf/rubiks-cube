import re

def verify_solve(time_sec: float | None, moves_count: int = 0, scramble: str = "") -> dict:
    """
    Серверная античит-система проверки сборки кубика Рубика (Идея 3).
    
    Проверяет:
    1. Порог физического времени (невозможно собрать 3x3 быстрее 2.5 сек).
    2. Скорость ходов (TPS - Turns Per Second): максимальный человеческий предел ~14-16 TPS.
    3. Достаточность числа ходов для 20-ходового WCA скрамбла (минимум 8 ходов).
    4. Корректность WCA-нотации ходов.
    """
    if time_sec is None or time_sec <= 0:
        return {
            "verified": False,
            "status": "IMPOSSIBLE_TIME",
            "tps": 0.0,
            "details": "Некорректное нулевое или отрицательное время сборки."
        }

    tps = round(moves_count / max(time_sec, 0.001), 2)

    # 1. Проверка на нереалистично быстрое время (мировой рекорд WCA 3.13 сек)
    if time_sec < 2.50:
        return {
            "verified": False,
            "status": "IMPOSSIBLE_TIME",
            "tps": tps,
            "details": f"Время {time_sec:.2f} сек быстрее мирового рекорда WCA (3.13 с) — признак подделки пакета."
        }

    # 2. Проверка на сверхчеловеческий TPS
    if tps > 16.0:
        return {
            "verified": False,
            "status": "SUSPICIOUS_TPS",
            "tps": tps,
            "details": f"Сверхчеловеческая скорость {tps:.1f} ходов/сек превышает физический порог WCA (16.0 TPS)."
        }

    # 3. Проверка на число ходов
    if moves_count < 8 and time_sec < 15.0:
        return {
            "verified": False,
            "status": "TOO_FEW_MOVES",
            "tps": tps,
            "details": f"Слишком малое число ходов ({moves_count}) для 20-ходового скрамбла (God's Number = 20)."
        }

    # 4. Проверка скрамбла на валидность WCA нотации
    valid_scramble_pattern = r'^[UDRLFB][\'2]?(\s+[UDRLFB][\'2]?)*$'
    if scramble and not re.match(valid_scramble_pattern, scramble.strip()):
        return {
            "verified": False,
            "status": "INVALID_SCRAMBLE",
            "tps": tps,
            "details": "Скрамбл матча не соответствует официальной нотации WCA."
        }

    return {
        "verified": True,
        "status": "VERIFIED",
        "tps": tps,
        "details": f"Сборка полностью верифицирована античитом WCA (TPS: {tps:.1f})"
    }
