import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Lock, 
  Mail, 
  Award, 
  Sliders, 
  Palette, 
  LogOut, 
  Check, 
  Sparkles, 
  ExternalLink, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  AlertCircle,
  Zap
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { API_BASE_URL, type WCARecord } from '../utils/api';
import { playCubeClick } from '../utils/audio';

const PRESET_PALETTES = [
  {
    name: 'WCA Классика',
    colors: {
      U: '#FFFFFF',
      D: '#FFD500',
      F: '#009B48',
      B: '#0046AD',
      L: '#FF5800',
      R: '#B71234',
    }
  },
  {
    name: 'Неоновый Киберпанк',
    colors: {
      U: '#00F0FF',
      D: '#FF007F',
      F: '#39FF14',
      B: '#7928CA',
      L: '#FF9900',
      R: '#FF003C',
    }
  },
  {
    name: 'Пастель',
    colors: {
      U: '#F0F4F8',
      D: '#FDFD96',
      F: '#77DD77',
      B: '#AEC6CF',
      L: '#FFB347',
      R: '#FF6961',
    }
  },
  {
    name: 'Монохром',
    colors: {
      U: '#FFFFFF',
      D: '#222222',
      F: '#666666',
      B: '#999999',
      L: '#CCCCCC',
      R: '#444444',
    }
  }
];

export function Profile() {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error, 
    login, 
    register, 
    logout, 
    updateProfile, 
    updateSettings, 
    fetchWCA,
    fetchMe,
    clearError 
  } = useAuthStore();

  // Состояние формы входа/регистрации
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    nickname: '',
    wcaId: '',
  });

  // Состояние профиля и настроек
  const [profileForm, setProfileForm] = useState({
    nickname: '',
    bio: '',
    wca_id: '',
    favorite_puzzle: '3x3',
  });

  const [settingsForm, setSettingsForm] = useState({
    theme: 'dark' as 'dark' | 'light',
    cube_sensitivity: 1.0,
    sound_enabled: true,
    custom_colors: {
      U: '#FFFFFF',
      D: '#FFD500',
      F: '#009B48',
      B: '#0046AD',
      L: '#FF5800',
      R: '#B71234',
    },
    keybindings: {},
  });

  const [wcaData, setWcaData] = useState<WCARecord | null>(null);
  const [wcaLoading, setWcaLoading] = useState(false);
  const [wcaError, setWcaError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // Проверка доступности Django API
  useEffect(() => {
    fetch(`${API_BASE_URL}/wca/test/`, { method: 'GET' })
      .then(() => setServerOnline(true))
      .catch(() => {
        // Если WCA 404 вернул — сервер работает! Если NetworkError/Failed to fetch — сервер оффлайн.
        fetch(API_BASE_URL.replace('/api', '/admin/'), { mode: 'no-cors' })
          .then(() => setServerOnline(true))
          .catch(() => setServerOnline(false));
      });
  }, []);

  // Синхронизация локальных состояний при загрузке пользователя
  useEffect(() => {
    if (isAuthenticated) {
      fetchMe();
    }
  }, [isAuthenticated, fetchMe]);

  useEffect(() => {
    if (user) {
      if (user.profile) {
        setProfileForm({
          nickname: user.profile.nickname || '',
          bio: user.profile.bio || '',
          wca_id: user.profile.wca_id || '',
          favorite_puzzle: user.profile.favorite_puzzle || '3x3',
        });
        if (user.profile.wca_id) {
          loadWCA(user.profile.wca_id);
        }
      }
      if (user.settings) {
        setSettingsForm({
          theme: user.settings.theme || 'dark',
          cube_sensitivity: user.settings.cube_sensitivity || 1.0,
          sound_enabled: user.settings.sound_enabled ?? true,
          custom_colors: user.settings.custom_colors || PRESET_PALETTES[0].colors,
          keybindings: user.settings.keybindings || {},
        });
      }
    }
  }, [user]);

  const loadWCA = async (id: string) => {
    if (!id.trim()) return;
    setWcaLoading(true);
    setWcaError(null);
    try {
      const data = await fetchWCA(id.trim());
      setWcaData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось загрузить данные WCA';
      setWcaError(msg);
      setWcaData(null);
    } finally {
      setWcaLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      if (isRegisterMode) {
        await register({
          username: authForm.username,
          email: authForm.email,
          password: authForm.password,
          password_confirm: authForm.passwordConfirm,
          nickname: authForm.nickname,
          wca_id: authForm.wcaId,
        });
      } else {
        await login(authForm.username, authForm.password);
      }
    } catch {
      // Ошибка обрабатывается в сторе
    }
  };

  const handleDemoLogin = async () => {
    clearError();
    try {
      await login('speedcuber', 'cuber123');
    } catch {
      // Ошибка
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaveSuccess(false);
      await updateProfile(profileForm);
      await updateSettings(settingsForm);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Ошибка
    }
  };

  const handleColorChange = (face: 'U' | 'D' | 'F' | 'B' | 'L' | 'R', color: string) => {
    setSettingsForm(prev => ({
      ...prev,
      custom_colors: {
        ...prev.custom_colors,
        [face]: color,
      }
    }));
  };

  const faceLabels: Record<string, string> = {
    U: 'Вверх (U)',
    D: 'Низ (D)',
    F: 'Перед (F)',
    B: 'Зад (B)',
    L: 'Лево (L)',
    R: 'Право (R)',
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full py-10 px-4 md:px-8 relative overflow-hidden flex flex-col items-center">
      {/* Фоновые декоративные свечения */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-brand-400/15 dark:bg-brand-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Верхний статус сервера Django */}
      <div className="w-full max-w-5xl mb-6 flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-400 animate-pulse' : serverOnline === false ? 'bg-amber-500' : 'bg-gray-400'}`} />
          <span className="text-brand-800/70 dark:text-brand-100/60 font-mono">
            {serverOnline ? 'Django REST API: Подключено (127.0.0.1:8000)' : serverOnline === false ? 'Django сервер оффлайн (запустите run_server.bat)' : 'Проверка соединения с Django...'}
          </span>
        </div>
        {isAuthenticated && (
          <button 
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-all font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </button>
        )}
      </div>

      {!isAuthenticated ? (
        /* ЭКРАН АВТОРИЗАЦИИ И РЕГИСТРАЦИИ */
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md flex flex-col items-center"
        >
          {/* Заголовок */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-400/15 border border-brand-400/30 text-brand-700 dark:text-brand-300 text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Личный кабинет
            </div>
            <h1 className="text-3xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-brand-900 via-brand-600 to-brand-400 dark:from-white dark:via-brand-200 dark:to-brand-400">
              {isRegisterMode ? 'Создать аккаунт' : 'Вход в профиль'}
            </h1>
            <p className="text-sm text-brand-800/70 dark:text-brand-100/70 mt-2">
              {isRegisterMode 
                ? 'Синхронизируйте свои настройки, рекорды и кастомную расцветку кубика.' 
                : 'Войдите, чтобы загрузить персональную расцветку и профиль WCA.'}
            </p>
          </div>

          {/* Быстрый демо-вход */}
          <button
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full mb-6 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-brand-500/20 hover:from-amber-500/30 hover:to-brand-500/30 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-500" />
            Войти как тестовый спидкубер (демо в 1 клик)
          </button>

          {/* Переключатель режима (Табы) */}
          <div className="w-full flex p-1 rounded-2xl bg-brand-400/10 dark:bg-white/5 border border-brand-400/20 mb-6">
            <button
              onClick={() => { setIsRegisterMode(false); clearError(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                !isRegisterMode 
                  ? 'bg-brand-500 text-white shadow-md' 
                  : 'text-brand-800/70 dark:text-brand-100/70 hover:text-brand-500'
              }`}
            >
              Авторизация
            </button>
            <button
              onClick={() => { setIsRegisterMode(true); clearError(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                isRegisterMode 
                  ? 'bg-brand-500 text-white shadow-md' 
                  : 'text-brand-800/70 dark:text-brand-100/70 hover:text-brand-500'
              }`}
            >
              Регистрация
            </button>
          </div>

          {/* Ошибка */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Форма */}
          <form onSubmit={handleAuthSubmit} className="w-full flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-brand-800/80 dark:text-brand-100/80 mb-1 ml-1">
                Логин
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 absolute left-3.5 text-brand-400 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="speedcuber"
                  value={authForm.username}
                  onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-brand-400/10 dark:bg-white/5 border border-brand-400/20 focus:border-brand-400 focus:outline-none text-sm text-brand-900 dark:text-brand-50 transition-colors"
                />
              </div>
            </div>

            {isRegisterMode && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-brand-800/80 dark:text-brand-100/80 mb-1 ml-1">
                    Email (необязательно)
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 absolute left-3.5 text-brand-400 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="cuber@example.com"
                      value={authForm.email}
                      onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-brand-400/10 dark:bg-white/5 border border-brand-400/20 focus:border-brand-400 focus:outline-none text-sm text-brand-900 dark:text-brand-50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-800/80 dark:text-brand-100/80 mb-1 ml-1">
                    Отображаемое имя / Никнейм
                  </label>
                  <div className="relative flex items-center">
                    <Sparkles className="w-4 h-4 absolute left-3.5 text-brand-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Максим"
                      value={authForm.nickname}
                      onChange={e => setAuthForm({ ...authForm, nickname: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-brand-400/10 dark:bg-white/5 border border-brand-400/20 focus:border-brand-400 focus:outline-none text-sm text-brand-900 dark:text-brand-50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-800/80 dark:text-brand-100/80 mb-1 ml-1">
                    WCA ID (если участвовали в соревнованиях)
                  </label>
                  <div className="relative flex items-center">
                    <Award className="w-4 h-4 absolute left-3.5 text-brand-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="2018PARK01"
                      value={authForm.wcaId}
                      onChange={e => setAuthForm({ ...authForm, wcaId: e.target.value.toUpperCase() })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-brand-400/10 dark:bg-white/5 border border-brand-400/20 focus:border-brand-400 focus:outline-none text-sm text-brand-900 dark:text-brand-50 transition-colors uppercase font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-brand-800/80 dark:text-brand-100/80 mb-1 ml-1">
                Пароль
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 absolute left-3.5 text-brand-400 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-brand-400/10 dark:bg-white/5 border border-brand-400/20 focus:border-brand-400 focus:outline-none text-sm text-brand-900 dark:text-brand-50 transition-colors"
                />
              </div>
            </div>

            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-brand-800/80 dark:text-brand-100/80 mb-1 ml-1">
                  Подтверждение пароля
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3.5 text-brand-400 pointer-events-none" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authForm.passwordConfirm}
                    onChange={e => setAuthForm({ ...authForm, passwordConfirm: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-brand-400/10 dark:bg-white/5 border border-brand-400/20 focus:border-brand-400 focus:outline-none text-sm text-brand-900 dark:text-brand-50 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-3 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-600 hover:to-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-500/25 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isRegisterMode ? (
                'Зарегистрироваться'
              ) : (
                'Войти'
              )}
            </button>
          </form>
        </motion.div>
      ) : (
        /* ЭКРАН АВТОРИЗОВАННОГО ПОЛЬЗОВАТЕЛЯ */
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-4xl flex flex-col gap-10"
        >
          {/* Секция 1: Шапка профиля */}
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 pb-8 border-b border-brand-400/20">
            <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-brand-500/30">
                {(profileForm.nickname || user?.username || 'U')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <h1 className="text-2xl md:text-4xl font-black text-brand-900 dark:text-white">
                    {profileForm.nickname || user?.username}
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-mono font-semibold">
                    @{user?.username}
                  </span>
                </div>
                <p className="text-sm text-brand-800/70 dark:text-brand-100/70 mt-1 max-w-md">
                  {profileForm.bio || 'Спидкубер и исследователь мира механических головоломок.'}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3 justify-center md:justify-start text-xs font-semibold">
                  <span className="px-3 py-1 rounded-xl bg-brand-400/10 border border-brand-400/20 text-brand-700 dark:text-brand-200">
                    Дисциплина: {profileForm.favorite_puzzle}
                  </span>
                  {profileForm.wca_id && (
                    <span className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 font-mono">
                      WCA ID: {profileForm.wca_id}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveAll}
              disabled={isLoading}
              className={`px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer ${
                saveSuccess 
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
                  : 'bg-gradient-to-r from-brand-500 to-brand-400 text-white shadow-brand-500/30 hover:from-brand-600 hover:to-brand-500'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Синхронизировано!
                </>
              ) : (
                <>
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Сохранить в облако
                </>
              )}
            </button>
          </div>

          {/* Секция 2: WCA Инспектор (Официальные рекорды) */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-brand-900 dark:text-white font-black text-xl">
              <Award className="w-6 h-6 text-amber-500" />
              <h2>Официальные результаты WCA (World Cube Association)</h2>
            </div>
            <div className="p-6 rounded-3xl bg-brand-400/5 dark:bg-white/5 border border-brand-400/20 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                <input
                  type="text"
                  placeholder="Введите WCA ID (например: 2018PARK01 или 2015BOBR01)"
                  value={profileForm.wca_id}
                  onChange={e => setProfileForm({ ...profileForm, wca_id: e.target.value.toUpperCase() })}
                  className="flex-1 w-full px-4 py-2.5 rounded-xl bg-brand-400/10 dark:bg-black/30 border border-brand-400/20 font-mono uppercase text-sm focus:outline-none focus:border-brand-400 text-brand-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => loadWCA(profileForm.wca_id)}
                  disabled={wcaLoading || !profileForm.wca_id.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {wcaLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Проверить в базе WCA
                </button>
              </div>

              {wcaError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{wcaError}</span>
                </div>
              )}

              {wcaData && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                  <div className="p-4 rounded-2xl bg-brand-400/10 dark:bg-black/40 border border-brand-400/20">
                    <span className="text-xs text-brand-800/60 dark:text-brand-100/60">Спортсмен</span>
                    <div className="text-lg font-black text-brand-900 dark:text-white mt-1">{wcaData.name}</div>
                    <span className="text-xs text-brand-400 font-semibold">{wcaData.country}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-brand-400/10 dark:bg-black/40 border border-brand-400/20">
                    <span className="text-xs text-brand-800/60 dark:text-brand-100/60">Официальный рекорд 3x3 (Single)</span>
                    <div className="text-2xl font-black text-amber-500 mt-1">{wcaData.records_333.single}</div>
                    <span className="text-xs text-brand-800/60 dark:text-brand-100/60">Лучшая единичная попытка</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-brand-400/10 dark:bg-black/40 border border-brand-400/20">
                    <span className="text-xs text-brand-800/60 dark:text-brand-100/60">Официальный рекорд 3x3 (Average)</span>
                    <div className="text-2xl font-black text-emerald-400 mt-1">{wcaData.records_333.average}</div>
                    <span className="text-xs text-brand-800/60 dark:text-brand-100/60">Среднее из 5 сборок (Ao5)</span>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Секция 3: Синхронизация 3D настроек симулятора */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-brand-900 dark:text-white font-black text-xl">
              <Palette className="w-6 h-6 text-brand-400" />
              <h2>Персональная расцветка кубика (Cloud Sync)</h2>
            </div>
            
            <div className="p-6 rounded-3xl bg-brand-400/5 dark:bg-white/5 border border-brand-400/20 backdrop-blur-md flex flex-col gap-6">
              {/* Пресеты */}
              <div>
                <span className="text-xs font-bold text-brand-800/70 dark:text-brand-100/70 uppercase tracking-wider block mb-3">
                  Готовые палитры:
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_PALETTES.map(p => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setSettingsForm(prev => ({ ...prev, custom_colors: p.colors }))}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-400/10 hover:bg-brand-400/20 border border-brand-400/20 text-xs font-semibold text-brand-900 dark:text-brand-50 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                      <div className="flex gap-0.5">
                        {Object.values(p.colors).slice(0, 4).map((c, i) => (
                          <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6 граней с колорпикерами */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {(['U', 'D', 'F', 'B', 'L', 'R'] as const).map(face => (
                  <div 
                    key={face} 
                    className="p-3 rounded-2xl bg-brand-400/10 dark:bg-black/30 border border-brand-400/20 flex flex-col items-center gap-2"
                  >
                    <span className="text-xs font-bold text-brand-800/80 dark:text-brand-100/80">{faceLabels[face]}</span>
                    <div className="relative group cursor-pointer">
                      <input
                        type="color"
                        value={settingsForm.custom_colors[face] || '#FFFFFF'}
                        onChange={e => handleColorChange(face, e.target.value)}
                        className="w-12 h-12 rounded-xl border-none cursor-pointer bg-transparent"
                      />
                    </div>
                    <span className="text-[11px] font-mono text-brand-800/60 dark:text-brand-100/60 uppercase">
                      {settingsForm.custom_colors[face]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Секция 4: Настройки чувствительности и звука */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-brand-900 dark:text-white font-black text-xl">
              <Sliders className="w-6 h-6 text-brand-400" />
              <h2>Физика и управление симулятором</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Слайдер чувствительности */}
              <div className="p-6 rounded-3xl bg-brand-400/5 dark:bg-white/5 border border-brand-400/20 backdrop-blur-md flex flex-col justify-between gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-brand-900 dark:text-white">Скорость и чувствительность 3D</span>
                    <span className="text-xs font-mono font-bold text-brand-400">{settingsForm.cube_sensitivity}x</span>
                  </div>
                  <p className="text-xs text-brand-800/70 dark:text-brand-100/70">
                    Регулирует скорость анимации вращения слоев и чувствительность захвата мышкой/пальцем.
                  </p>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.5"
                  step="0.1"
                  value={settingsForm.cube_sensitivity}
                  onChange={e => setSettingsForm({ ...settingsForm, cube_sensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>

              {/* Переключатель звука */}
              <div className="p-6 rounded-3xl bg-brand-400/5 dark:bg-white/5 border border-brand-400/20 backdrop-blur-md flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-sm text-brand-900 dark:text-white block">Механические щелчки граней</span>
                  <p className="text-xs text-brand-800/70 dark:text-brand-100/70 mt-1">
                    Воспроизведение реалистичного звука пластика при вращении слоев кубика.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !settingsForm.sound_enabled;
                    setSettingsForm(prev => ({ ...prev, sound_enabled: nextVal }));
                    localStorage.setItem('cube-sound-enabled', String(nextVal));
                    if (nextVal) playCubeClick();
                  }}
                  className={`p-3 rounded-2xl transition-all cursor-pointer ${
                    settingsForm.sound_enabled 
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' 
                      : 'bg-brand-400/10 text-brand-800/40 dark:text-brand-100/40'
                  }`}
                >
                  {settingsForm.sound_enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
