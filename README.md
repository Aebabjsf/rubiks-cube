# Rubik's World — Django Backend & Realtime WebSockets API

Бэкенд-сервис на Django REST Framework и Daphne/Channels для веб-платформы «Rubik's World».
Реализует:
1. **Личный кабинет спидкубера, JWT-аутентификацию и облачную синхронизацию настроек**;
2. **Онлайн PvP-дуэли 1 на 1 в реальном времени через WebSockets**.

---

## 🚀 Быстрый запуск

### 1. Запуск через скрипт (Windows)
Дважды кликните по файлу `run_server.bat` в папке `backend`.

### 2. Запуск через терминал
```powershell
cd backend
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Сервер будет доступен по адресу: `http://127.0.0.1:8000/`  
Панель администратора Django: `http://127.0.0.1:8000/admin/`

---

## 👤 Предустановленные тестовые аккаунты

| Логин | Пароль | Роль | Описание |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | Суперпользователь | Доступ в админку Django (`/admin/`) |
| `speedcuber` | `cuber123` | Пользователь | Демо-аккаунт с настроенным профилем |

---

## 📡 Спецификация REST API

### 1. Аутентификация (JWT)

#### `POST /api/auth/register/` — Регистрация
**Тело запроса:**
```json
{
  "username": "cuber2026",
  "email": "cuber@example.com",
  "password": "strongpassword123",
  "password_confirm": "strongpassword123",
  "nickname": "Кубист",
  "wca_id": "2018PARK01"
}
```
**Ответ (201 Created):**
Возвращает объект пользователя, профиль, начальные настройки и пару токенов `access` и `refresh`.

#### `POST /api/auth/login/` — Авторизация (получение JWT)
**Тело запроса:**
```json
{
  "username": "speedcuber",
  "password": "cuber123"
}
```
**Ответ (200 OK):**
```json
{
  "refresh": "eyJhbGciOi...",
  "access": "eyJhbGciOi..."
}
```

#### `POST /api/auth/refresh/` — Обновление Access-токена
Передается `{ "refresh": "<refresh_token>" }`, возвращает новый `access` токен.

---

### 2. Данные пользователя и профиль

> Во все эндпоинты ниже необходимо передавать заголовок:  
> `Authorization: Bearer <access_token>`

#### `GET /api/auth/me/` — Полная информация о текущем пользователе
Возвращает профиль (`profile`) и все настройки (`settings`).

#### `GET /api/profile/` — Получить профиль спидкубера
#### `PATCH /api/profile/` — Обновить профиль
**Пример тела запроса:**
```json
{
  "nickname": "Максим Спидкубер",
  "bio": "Любимая дисциплина — 3x3x3",
  "wca_id": "2015BOBR01",
  "favorite_puzzle": "3x3"
}
```
*(Также поддерживается отправка аватара в `multipart/form-data`).*

---

### 3. Синхронизация настроек симулятора

#### `GET /api/settings/` — Получить настройки
#### `PATCH /api/settings/` — Синхронизировать настройки кубика
**Пример тела запроса:**
```json
{
  "theme": "dark",
  "cube_sensitivity": 1.3,
  "sound_enabled": true,
  "custom_colors": {
    "U": "#FFFFFF",
    "D": "#FFD500",
    "F": "#009B48",
    "B": "#0046AD",
    "L": "#FF5800",
    "R": "#B71234"
  },
  "keybindings": {
    "U": "u",
    "U_prime": "U",
    "R": "r",
    "R_prime": "R"
  }
}
```

---

### 4. Интеграция с World Cube Association (WCA)

#### `GET /api/wca/<wca_id>/`
*Авторизация не требуется.*  
Запрашивает данные с официального API WCA и возвращает официальные рекорды (Single / Average) и медали спортсмена:
```bash
curl http://127.0.0.1:8000/api/wca/2015BOBR01/
```

---

### 5. Онлайн PvP-дуэли и WebSockets

#### `GET /api/duels/rooms/` — Список активных комнат и завершенных дуэлей
#### `POST /api/duels/create/` — Создать новую комнату для дуэли

#### `WebSocket ws://127.0.0.1:8000/ws/duel/<ROOM_CODE>/`
Протокол событий в реальном времени:
* **Клиент $\rightarrow$ Сервер:**
  * `{ "action": "join", "player_name": "..." }` — подключение к комнате;
  * `{ "action": "ready" }` — подтверждение готовности к матчу;
  * `{ "action": "progress", "moves": 12, "time": 8.4 }` — трансляция живого прогресса;
  * `{ "action": "finish", "time": 15.2, "moves": 42 }` — фиксация сборки;
  * `{ "action": "rematch" }` — запрос реванша.
* **Сервер $\rightarrow$ Клиенты:**
  * `room_state` — актуальный состав игроков и их готовность;
  * `match_starting` — синхронный WCA-скрамбл и таймер обратного отсчета (3, 2, 1, СТАРТ!);
  * `opponent_progress` — ходы и секундомер соперника в реальном времени;
  * `player_finished` — объявление победителя и итогового времени.

---

## 🧪 Запуск автоматических тестов

```powershell
cd backend
.\venv\Scripts\python.exe manage.py test profiles duels
```
Все юнит-тесты проверяют сценарии регистрации, авторизации по JWT, генерации WCA-скрамблов и сохранения дуэлей.
