import random

def generate_wca_scramble(length: int = 20) -> str:
    """
    Генерирует официальный WCA-скрамбл для кубика 3x3x3.
    Гарантирует:
    - Отсутствие двух последовательных ходов одной грани (например, R R').
    - Отсутствие взаимно компенсирующих ходов противоположных граней (например, R L R').
    """
    faces = ['U', 'D', 'R', 'L', 'F', 'B']
    modifiers = ['', "'", '2']
    
    # Противоположные грани
    opposites = {
        'U': 'D', 'D': 'U',
        'R': 'L', 'L': 'R',
        'F': 'B', 'B': 'F'
    }

    scramble = []
    last_face = ''
    second_last_face = ''

    for _ in range(length):
        valid_faces = [
            f for f in faces
            if f != last_face and not (f == second_last_face and opposites.get(f) == last_face)
        ]
        chosen_face = random.choice(valid_faces)
        chosen_mod = random.choice(modifiers)
        scramble.append(f"{chosen_face}{chosen_mod}")

        second_last_face = last_face
        last_face = chosen_face

    return " ".join(scramble)
