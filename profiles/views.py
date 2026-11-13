import urllib.request
import json
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Profile, UserSettings
from .serializers import (
    RegisterSerializer,
    UserDetailSerializer,
    ProfileSerializer,
    UserSettingsSerializer,
)


class RegisterView(generics.CreateAPIView):
    """Эндпоинт для регистрации нового спидкубера."""
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Автоматическая генерация JWT пары токенов
        refresh = RefreshToken.for_user(user)

        return Response({
            "message": "Регистрация прошла успешно!",
            "user": UserDetailSerializer(user, context={'request': request}).data,
            "tokens": {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class CurrentUserView(APIView):
    """Получение полных данных текущего авторизованного пользователя (профиль + настройки)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserDetailSerializer(request.user, context={'request': request})
        return Response(serializer.data)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """Просмотр и редактирование личного профиля спидкубера (аватар, WCA ID, био)."""
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.profile


class UserSettingsView(generics.RetrieveUpdateAPIView):
    """Просмотр и синхронизация настроек (цвета кубика, чувствительность, горячие клавиши, тема)."""
    serializer_class = UserSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.settings


class WCAInfoView(APIView):
    """
    Интеграция с официальным API World Cube Association.
    Позволяет валидировать и подтягивать реальную статистику и рекорды спидкубера по его WCA ID.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, wca_id):
        wca_id = wca_id.strip().upper()
        url = f"https://www.worldcubeassociation.org/api/v0/persons/{wca_id}"
        
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "RubiksWorldCoursework/1.0"}
        )

        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    person = data.get("person", {})
                    personal_bests = data.get("personal_bests", {})
                    
                    # Извлекаем персональные рекорды для 3x3
                    pb_333 = personal_bests.get("333", {})
                    single_time = pb_333.get("single", {}).get("best")
                    average_time = pb_333.get("average", {}).get("best")

                    # Время в WCA API возвращается в сантисекундах (сотые доли секунды)
                    format_time = lambda cs: f"{cs / 100:.2f} сек" if cs else "Нет данных"

                    return Response({
                        "wca_id": person.get("wca_id", wca_id),
                        "name": person.get("name"),
                        "country": person.get("country_iso2"),
                        "medals": data.get("medals", {}),
                        "records_333": {
                            "single": format_time(single_time),
                            "average": format_time(average_time),
                        }
                    })
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return Response(
                    {"error": f"Спидкубер с WCA ID '{wca_id}' не найден в базе данных WCA."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            return Response(
                {"error": f"Ошибка запроса к WCA API: {e.code}"}, 
                status=status.HTTP_502_BAD_GATEWAY
            )
        except Exception as e:
            return Response(
                {"error": f"Не удалось соединиться с WCA: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
