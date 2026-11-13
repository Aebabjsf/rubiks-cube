from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import Profile, UserSettings


class ProfileAndAuthTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
        self.login_url = '/api/auth/login/'
        self.me_url = '/api/auth/me/'
        self.profile_url = '/api/profile/'
        self.settings_url = '/api/settings/'

    def test_user_registration_creates_profile_and_settings(self):
        data = {
            "username": "speedcuber1",
            "email": "cuber@example.com",
            "password": "secretpassword123",
            "password_confirm": "secretpassword123",
            "nickname": "Кубический Мастер",
            "wca_id": "2018PARK01"
        }
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])

        # Проверяем, что в БД созданы User, Profile и UserSettings
        user = User.objects.get(username="speedcuber1")
        self.assertTrue(hasattr(user, 'profile'))
        self.assertEqual(user.profile.nickname, "Кубический Мастер")
        self.assertEqual(user.profile.wca_id, "2018PARK01")
        self.assertTrue(hasattr(user, 'settings'))
        self.assertEqual(user.settings.theme, "dark")
        self.assertEqual(user.settings.cube_sensitivity, 1.0)
        self.assertEqual(user.settings.custom_colors["U"], "#FFFFFF")

    def test_user_login_and_jwt_auth(self):
        # Создаем пользователя
        user = User.objects.create_user(
            username="testuser",
            password="testpassword123"
        )
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        access_token = response.data['access']

        # Проверяем эндпоинт /api/auth/me/ с токеном
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_response = self.client.get(self.me_url)
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data['username'], 'testuser')
        self.assertEqual(me_response.data['settings']['theme'], 'dark')

    def test_update_settings_and_colors(self):
        user = User.objects.create_user(username="settingsuser", password="password123")
        self.client.force_authenticate(user=user)

        new_settings = {
            "theme": "light",
            "cube_sensitivity": 1.5,
            "sound_enabled": False,
            "custom_colors": {
                "U": "#E0E0E0",
                "D": "#FFCC00",
                "F": "#00AA00",
                "B": "#0033CC",
                "L": "#FF6600",
                "R": "#CC0000"
            }
        }
        response = self.client.patch(self.settings_url, new_settings, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        user.settings.refresh_from_db()
        self.assertEqual(user.settings.theme, "light")
        self.assertEqual(user.settings.cube_sensitivity, 1.5)
        self.assertFalse(user.settings.sound_enabled)
        self.assertEqual(user.settings.custom_colors["U"], "#E0E0E0")

    def test_update_profile(self):
        user = User.objects.create_user(username="profileuser", password="password123")
        self.client.force_authenticate(user=user)

        update_data = {
            "nickname": "Фелдикс",
            "bio": "Люблю собирать кубик Рубика за 5 секунд",
            "favorite_puzzle": "pyraminx",
            "wca_id": "2015BOBR01"
        }
        response = self.client.patch(self.profile_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        user.profile.refresh_from_db()
        self.assertEqual(user.profile.nickname, "Фелдикс")
        self.assertEqual(user.profile.favorite_puzzle, "pyraminx")
        self.assertEqual(user.profile.wca_id, "2015BOBR01")
