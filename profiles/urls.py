from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from .views import (
    RegisterView,
    CurrentUserView,
    UserProfileView,
    UserSettingsView,
    WCAInfoView,
)

urlpatterns = [
    # Аутентификация (JWT)
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('auth/me/', CurrentUserView.as_view(), name='current_user'),

    # Профиль и синхронизация настроек
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('settings/', UserSettingsView.as_view(), name='user_settings'),

    # Интеграция с официальным WCA API
    path('wca/<str:wca_id>/', WCAInfoView.as_view(), name='wca_info'),
]
