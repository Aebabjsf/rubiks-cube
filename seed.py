import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from profiles.models import Profile, UserSettings

def create_demo_data():
    # 1. Superuser
    if not User.objects.filter(username='admin').exists():
        admin = User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
        admin.profile.nickname = "Главный Администратор"
        admin.profile.bio = "Администратор платформы Rubik's World"
        admin.profile.wca_id = "2018PARK01"
        admin.profile.save()
        print("✓ Создан суперпользователь: admin / admin123")
    else:
        print("Суперпользователь admin уже существует.")

    # 2. Demo Speedcuber
    if not User.objects.filter(username='speedcuber').exists():
        user = User.objects.create_user('speedcuber', 'cuber@example.com', 'cuber123')
        user.profile.nickname = "Максим М."
        user.profile.bio = "Студент гр. ИС-41. Собираю 3x3 за 12 секунд."
        user.profile.wca_id = "2015BOBR01"
        user.profile.favorite_puzzle = "3x3"
        user.profile.save()

        user.settings.theme = "dark"
        user.settings.cube_sensitivity = 1.2
        user.settings.save()
        print("✓ Создан демо-пользователь: speedcuber / cuber123")
    else:
        print("Пользователь speedcuber уже существует.")

if __name__ == '__main__':
    create_demo_data()
