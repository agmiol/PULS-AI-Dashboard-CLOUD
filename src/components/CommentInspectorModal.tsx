import React, { useState, useEffect, useCallback } from 'react';
import { FeedbackComment, DashboardFilters } from '../types';
import {
  X,
  Search,
  MessageSquare,
  Tag,
  MapPin,
  Building2,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface CommentInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  comments?: FeedbackComment[];
  totalCount?: number;
  filters: DashboardFilters;
  isMobileSimulator?: boolean;
}

export const CommentInspectorModal: React.FC<CommentInspectorModalProps> = ({
  isOpen,
  onClose,
  filters,
  isMobileSimulator = false
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [personTypeFilter, setPersonTypeFilter] = useState<'all' | '2' | '1'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(30);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [personTypeFilter, filters]);

  // Fetch comments from server with live search & pagination
  const fetchComments = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/all-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters,
          search: activeSearch,
          page: currentPage,
          pageSize,
          personTypeFilter: personTypeFilter !== 'all' ? personTypeFilter : undefined
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setComments(data.comments || []);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.error('[CommentInspector] Failed to fetch comments:', err);
      setError('Не вдалося завантажити коментарі. Перевірте зʼєднання з базою даних.');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, filters, activeSearch, currentPage, pageSize, personTypeFilter]);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, fetchComments]);

  if (!isOpen) return null;

  return (
    <div
      className={
        isMobileSimulator
          ? "absolute inset-0 z-50 bg-slate-900/85 backdrop-blur-xs flex flex-col justify-end overflow-hidden animate-fadeIn"
          : "fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fadeIn"
      }
    >
      <div
        className={
          isMobileSimulator
            ? "bg-white w-full h-full max-h-full flex flex-col shadow-2xl overflow-hidden"
            : "bg-white rounded-t-3xl sm:rounded-2xl max-w-5xl w-full h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        }
      >
        {/* Header */}
        <div className="p-3.5 sm:p-5 bg-slate-900 text-white flex flex-col gap-2.5 border-b border-slate-800 shrink-0">
          {/* Mobile Handle Indicator */}
          <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto sm:hidden -mt-0.5 mb-1" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="p-2 sm:p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0 mt-0.5">
                <MessageSquare className="w-4 h-4 sm:w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wide">
                    База коментарів
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Вся база: {totalCount.toLocaleString()} коментарів
                  </span>
                </div>
                <h2 className="text-sm sm:text-lg font-extrabold text-white mt-1 leading-snug break-words">
                  Повний реєстр текстових коментарів (`feedback_e`)
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">
                  Прямий доступ та повнотекстовий пошук по всіх відгуках із врахуванням активних крос-фільтрів
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer shrink-0"
              title="Закрити вікно бази коментарів"
            >
              <X className="w-4 h-4 sm:w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Summary & Search Toolbar */}
        <div className="p-2.5 sm:p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shrink-0">
          {/* Status & Sub-filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="font-extrabold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs text-[10px] sm:text-xs whitespace-nowrap">
                Знайдено: {totalCount.toLocaleString()}
              </span>

              {/* Person Type Selector */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg font-bold flex-1 sm:flex-initial">
                <button
                  onClick={() => setPersonTypeFilter('all')}
                  className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] transition-all cursor-pointer text-center ${
                    personTypeFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Всі
                </button>
                <button
                  onClick={() => setPersonTypeFilter('2')}
                  className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] transition-all cursor-pointer text-center ${
                    personTypeFilter === '2'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ФОП
                </button>
                <button
                  onClick={() => setPersonTypeFilter('1')}
                  className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] transition-all cursor-pointer text-center ${
                    personTypeFilter === '1'
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Юр. особи
                </button>
              </div>
            </div>
          </div>

          {/* Full Database Search Input */}
          <div className="relative w-full sm:w-80 block">
            <Search className="w-3.5 h-3.5 text-blue-600 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Пошук по всіх коментарях, проблемах, областях..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Очистити пошук"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Comments List Body */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2.5 sm:space-y-3 bg-slate-100/60">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-bold text-slate-600">
                Вибірка коментарів з бази даних PostgreSQL (`feedback_e`)...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-rose-500 bg-white rounded-xl border border-rose-200 p-6 space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
              <p className="font-bold text-sm">{error}</p>
              <button
                onClick={() => fetchComments()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Спробувати знову
              </button>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-white rounded-xl border border-slate-200 p-6">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="font-extrabold text-sm text-slate-700">Коментарів не знайдено</p>
              <p className="text-xs mt-1 text-slate-400 max-w-md mx-auto">
                За поточними критеріями фільтрації або пошуковим запитом результати відсутні. Спробуйте змінити параметри пошуку.
              </p>
            </div>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 transition-all space-y-2"
              >
                {/* Meta Row */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b pb-2 border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Score Badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-black tracking-wide ${
                        c.score >= 9
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : c.score >= 7
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      ★ {c.score} / 10
                    </span>

                    {/* Person Type */}
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {c.persontype === '2' ? (
                        <User className="w-3 h-3 text-blue-600 shrink-0" />
                      ) : (
                        <Building2 className="w-3 h-3 text-teal-600 shrink-0" />
                      )}
                      <span>{c.personTypeLabel}</span>
                    </span>

                    {/* Region */}
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                      <span>{c.oblast}</span>
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                    #{c.id} • {c.created_at}
                  </span>
                </div>

                {/* Comment Text */}
                <div className="text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50/90 p-2.5 sm:p-3 rounded-lg border border-slate-100 font-sans break-words">
                  «{c.processed_comment || c.comment}»
                </div>

                {/* Issue Tags */}
                {(c.general_issue_title || c.detailed_issue_title) && (
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap text-[10px]">
                    {c.general_issue_title && (
                      <span className="inline-flex items-center gap-1 font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        <Tag className="w-2.5 h-2.5 text-blue-600" />
                        <span>{c.general_issue_title}</span>
                      </span>
                    )}
                    {c.detailed_issue_title && c.detailed_issue_title !== c.general_issue_title && (
                      <span className="inline-flex items-center gap-1 font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        <span>• {c.detailed_issue_title}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer & Full Pagination Bar */}
        <div className="p-2.5 sm:p-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
              Джерело: таблиця <code className="text-blue-700 font-mono">feedback_e</code> (PULS_COPY)
            </span>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage(1)}
                  className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Перша сторінка"
                >
                  <ChevronsLeft className="w-3.5 h-3.5 text-slate-600" />
                </button>
                <button
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Попередня сторінка"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                </button>

                <span className="font-extrabold text-slate-800 text-[10px] sm:text-xs px-1.5 whitespace-nowrap">
                  {currentPage} з {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Наступна сторінка"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                </button>
                <button
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Остання сторінка"
                >
                  <ChevronsRight className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer text-center"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
