import React, { useState, useEffect } from 'react';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw, Server, Table, Settings, Save, KeyRound, Globe, Wifi } from 'lucide-react';
import { DashboardData } from '../types';

interface DbStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbInfo: DashboardData['dbInfo'] | undefined;
  onRecheckConnection: () => void;
}

export const DbStatusModal: React.FC<DbStatusModalProps> = ({
  isOpen,
  onClose,
  dbInfo,
  onRecheckConnection
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'config'>('status');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Connection settings state
  const [host, setHost] = useState('della-proportions.tun.ply.gg');
  const [port, setPort] = useState('37079');
  const [user, setUser] = useState('ai_readonly');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('PULS_COPY');
  const [ssl, setSsl] = useState(false);

  // Status message state
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load current DB config from server when modal opens
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/db-config')
      .then(res => res.json())
      .then(data => {
        if (data && data.config) {
          if (data.config.host) setHost(data.config.host);
          if (data.config.port) setPort(String(data.config.port));
          if (data.config.user) setUser(data.config.user);
          if (data.config.database) setDatabase(data.config.database);
          if (data.config.ssl !== undefined) setSsl(data.config.ssl);
        }
      })
      .catch(err => console.warn('[DbStatusModal] Failed to fetch db-config:', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setStatusMessage(null);
    try {
      await onRecheckConnection();
      setStatusMessage({
        type: 'success',
        text: 'Перевірку з\'єднання виконано. База даних відповідає в реальному часі.'
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Помилка при перевірці з\'єднання: ' + (err.message || 'Спробуйте ще раз')
      });
    } finally {
      setTesting(false);
    }
  };

  const handleApplyPreset = () => {
    setHost('della-proportions.tun.ply.gg');
    setPort('37079');
    setUser('ai_readonly');
    setPassword('');
    setDatabase('PULS_COPY');
    setSsl(false);
    setStatusMessage({
      type: 'info',
      text: 'Встановлено параметри за замовчуванням. Існуючий пароль на сервері збережеться без змін.'
    });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const payload = {
        host: host.trim(),
        port: parseInt(port.trim(), 10) || 21424,
        user: user.trim(),
        password,
        database: database.trim(),
        ssl
      };

      const res = await fetch('/api/db-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Не вдалося підключитися з вказаними параметрами');
      }

      setStatusMessage({
        type: 'success',
        text: `Параметри оновлено! ${data.message || 'Успішно підключено.'}`
      });

      // Refresh dashboard data with new connection
      await onRecheckConnection();

      // Switch back to status tab after short delay
      setTimeout(() => {
        setActiveTab('status');
      }, 1200);

    } catch (err: any) {
      console.error('[DbStatusModal] Save error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Помилка підключення до сервера бази даних'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Джерело даних: PostgreSQL</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                  {database}
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'status'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Server className="w-4 h-4 text-sky-600" />
            <span>Статус і таблиці</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'config'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Settings className="w-4 h-4 text-amber-600" />
            <span>Налаштування доступу</span>
          </button>
        </div>

        {/* Status Message Notification */}
        {statusMessage && (
          <div className={`mx-5 mt-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}>
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            {statusMessage.type === 'info' && <Wifi className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />}
            <span className="leading-relaxed font-medium">{statusMessage.text}</span>
          </div>
        )}

        {/* Tab 1: Status & Tables */}
        {activeTab === 'status' && (
          <div className="p-5 space-y-4 text-xs text-slate-700 overflow-y-auto max-h-[70vh]">
            {/* Connection Banner */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              dbInfo?.connected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}>
              {dbInfo?.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 w-full">
                <div className="font-bold text-sm">
                  {dbInfo?.connected
                    ? `Успішно підключено до бази даних ${database}`
                    : 'Очікування доступу до бази даних (pg_hba.conf)'}
                </div>
                {!dbInfo?.connected && (
                  <p className="text-xs opacity-90 leading-relaxed">
                    Потрібно дозволити підключення для вашої IP-адреси у конфігураційному файлі pg_hba.conf на сервері PostgreSQL.
                  </p>
                )}
              </div>
            </div>

            {/* Error / Instruction Box */}
            {dbInfo?.lastError && (
              <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-rose-500/30 space-y-2 shadow-lg">
                <div className="flex items-center gap-2 font-bold text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Діагностика підключення та інструкція з вирішення:</span>
                </div>
                <pre className="text-[11px] font-mono leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap break-all text-amber-200 select-all overflow-x-auto">
                  {dbInfo.lastError}
                </pre>
              </div>
            )}

            {/* Connection Mode & Security */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Server className="w-4 h-4 text-sky-600" />
                  <span>Поточна URL-адреса підключення:</span>
                </div>
                <span className="font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px]">
                  {dbInfo?.mode === 'postgresql' ? 'PostgreSQL' : 'In-Memory Cache'}
                </span>
              </div>
              <div className="font-mono text-xs font-semibold text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 break-all select-all shadow-inner">
                {dbInfo?.dbUrl || `postgresql://${user}:***@${host}:${port}/${database}`}
              </div>
            </div>

            {/* Table Statistics */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                <Table className="w-4 h-4 text-sky-600" />
                <span>Реєстр таблиць та кількість записів у базі:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">`feedback_e`</span>
                  <span className="font-black text-slate-900">{(dbInfo?.tables.feedback_e ?? 0).toLocaleString('uk-UA')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">`general_issues`</span>
                  <span className="font-black text-slate-900">{(dbInfo?.tables.general_issues ?? 0).toLocaleString('uk-UA')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">`detailed_issues`</span>
                  <span className="font-black text-slate-900">{(dbInfo?.tables.detailed_issues ?? 0).toLocaleString('uk-UA')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">`general_issue_comment`</span>
                  <span className="font-black text-slate-900">{(dbInfo?.tables.general_issue_comment ?? 0).toLocaleString('uk-UA')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">`detailed_issue_comment`</span>
                  <span className="font-black text-slate-900">{(dbInfo?.tables.detailed_issue_comment ?? 0).toLocaleString('uk-UA')}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">`regions`</span>
                  <span className="font-black text-slate-900">{(dbInfo?.tables.regions ?? 0).toLocaleString('uk-UA')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Config / Tunnel Editor */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveConfig} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <div className="font-bold flex items-center gap-1.5 text-xs text-amber-950">
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Автономне керування параметрами середовища</span>
              </div>
            </div>

            {/* Quick Preset Button */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Globe className="w-4 h-4 text-sky-600" />
                <span>Швидкі параметри:</span>
              </div>
              <button
                type="button"
                onClick={handleApplyPreset}
                className="px-3 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold border border-sky-300 transition-all text-[11px] cursor-pointer"
              >
                Вставити значення за замовчуванням
              </button>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Хост (DB Host / Address):
                </label>
                <input
                  type="text"
                  required
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="наприклад, della-proportions.tun.ply.gg"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Порт (DB Port):
                </label>
                <input
                  type="text"
                  required
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="наприклад, 37079"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Користувач (DB User):
                </label>
                <input
                  type="text"
                  required
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Пароль (DB Password):
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Залишити поточний або ввести новий"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Назва бази даних (DB Name):
                </label>
                <input
                  type="text"
                  required
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={ssl}
                    onChange={(e) => setSsl(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                  />
                  <span>Використовувати SSL підключення</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Зберегти та перепідключитись</span>
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            Останній огляд: {new Date(dbInfo?.lastRefreshed || Date.now()).toLocaleTimeString()}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>Тестувати з'єднання</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer"
            >
              Закрити
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
