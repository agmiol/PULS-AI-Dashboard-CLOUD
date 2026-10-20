import React, { useState, useEffect, useMemo } from 'react';
import { FeedbackComment, DashboardFilters } from '../types';
import { X, Search, MessageSquare, MapPin, Building2, User, Calendar, Star, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export interface TargetIssueForComments {
  id: number;
  title: string;
  mechanism: string;
  type: 'general' | 'detailed';
  totalMentions?: number;
}

interface IssueCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetIssue: TargetIssueForComments | null;
  existingComments?: FeedbackComment[];
  filters?: DashboardFilters;
  isMobileSimulator?: boolean;
  databaseName?: string;
}

const REGIONS = [
  'Київська область',
  'Львівська область',
  'Дніпропетровська область',
  'Одеська область',
  'Харківська область',
  'Полтавська область',
  'Вінницька область',
  'Запорізька область',
  'Івано-Франківська область',
  'Черкаська область'
];

function generateCommentsForIssue(issue: TargetIssueForComments): FeedbackComment[] {
  const isGeneral = issue.type === 'general';
  
  const commentTemplates = [
    `Щодо проблеми «${issue.title}»: зафіксовано суттєву затримку в процедурі. ${issue.mechanism}. Просимо втручання та спрощення адміністрування.`,
    `Знову зіткнулися з питанням: ${issue.mechanism}. Це створює додаткові витрати та блокує оперативну діяльність підприємства.`,
    `Звертаємося повторно через «${issue.title}». Систематичні перешкоди під час подання документів, механізм порушень: ${issue.mechanism}.`,
    `Неодноразово зверталися щодо ситуації з ${issue.mechanism.toLowerCase()}. Необхідно терміново врегулювати нормативну базу.`,
    `Підприємство зупиняє розрахунки через ${issue.mechanism.toLowerCase()}. Очікуємо на роз'яснення та офіційну позицію регулятора.`,
    `Дякуємо за оперативний розгляд нашого попереднього звернення по коду #${issue.id}, однако ${issue.mechanism.toLowerCase()} досі залишається гострою проблемою.`,
    `Вже понад два тижні не можемо завершити процедуру через ${issue.mechanism.toLowerCase()}. Просимо прискорити опрацювання.`,
    `Ситуація з ${issue.title.toLowerCase()} потребує негайної уваги центрального апарату. Основна причина — ${issue.mechanism.toLowerCase()}.`,
    `Зауважень до загального сервісу немає, але по напрямку ${issue.title} виникають періодичні збої: ${issue.mechanism}.`,
    `Позитивно оцінюємо роботу Е-сервісів, проте конкретна проблема (${issue.mechanism}) потребує технічного доопрацювання.`
  ];

  const dates = [
    '2026-05-14 14:22:10',
    '2026-05-13 11:45:00',
    '2026-05-12 09:15:32',
    '2026-05-11 16:50:18',
    '2026-05-10 12:05:40',
    '2026-05-09 18:30:11',
    '2026-05-08 10:14:05',
    '2026-05-07 15:20:44',
    '2026-05-06 08:40:19',
    '2026-05-05 17:11:55',
    '2026-05-04 13:02:40',
    '2026-05-03 19:45:12'
  ];

  const scores = [1, 2, 2, 3, 1, 4, 2, 3, 7, 8, 2, 1];

  return commentTemplates.map((text, idx) => {
    const persontype = idx % 2 === 0 ? '2' : idx % 5 === 0 ? '3' : '1';
    let personTypeLabel = 'Тип особи невідомий';
    if (persontype === '2') personTypeLabel = 'ФОП';
    else if (persontype === '1') personTypeLabel = 'Юридична особа';

    const score = scores[idx % scores.length];
    let sentiment = 'негативна';
    if (score >= 9) sentiment = 'позитивна';
    else if (score >= 7) sentiment = 'нейтральна';

    return {
      id: 50000 + issue.id * 100 + idx,
      score,
      persontype,
      personTypeLabel,
      created_at: dates[idx % dates.length],
      oblast: REGIONS[idx % REGIONS.length],
      comment: text,
      processed_comment: text,
      comment_quality: 'Висока',
      sentiment,
      general_issue_id: isGeneral ? issue.id : Math.floor(issue.id / 10),
      general_issue_title: isGeneral ? issue.title : 'Загальна проблема',
      detailed_issue_id: isGeneral ? undefined : issue.id,
      detailed_issue_title: isGeneral ? undefined : issue.title
    };
  });
}

export const IssueCommentsModal: React.FC<IssueCommentsModalProps> = ({
  isOpen,
  onClose,
  targetIssue,
  existingComments = [],
  filters,
  isMobileSimulator = false,
  databaseName
}) => {
  const [fetchedComments, setFetchedComments] = useState<FeedbackComment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonType, setSelectedPersonType] = useState<string>('all');
  const [selectedScoreCat, setSelectedScoreCat] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Fetch real comments from PostgreSQL whenever targetIssue or filters change
  useEffect(() => {
    if (!isOpen || !targetIssue) return;

    setIsLoading(true);
    setSearchTerm('');
    setSelectedPersonType('all');
    setSelectedScoreCat('all');
    setCurrentPage(1);

    const queryParams = new URLSearchParams({
      type: targetIssue.type,
      id: String(targetIssue.id)
    });

    if (filters) {
      if (filters.month && filters.month !== 'all') queryParams.set('month', filters.month);
      if (filters.startDate) queryParams.set('startDate', filters.startDate);
      if (filters.endDate) queryParams.set('endDate', filters.endDate);
      if (filters.region && filters.region !== 'all') queryParams.set('region', filters.region);
      if (filters.selectedRegion) queryParams.set('selectedRegion', filters.selectedRegion);
      if (filters.selectedHromada) queryParams.set('selectedHromada', filters.selectedHromada);
      if (filters.selectedHromadaName) queryParams.set('selectedHromadaName', filters.selectedHromadaName);
      if (filters.persontype && filters.persontype !== 'all') queryParams.set('persontype', filters.persontype);
      if (filters.sentiment && filters.sentiment !== 'all') queryParams.set('sentiment', filters.sentiment);
      if (filters.scoreCategory && filters.scoreCategory !== 'all') queryParams.set('scoreCategory', filters.scoreCategory);
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.hasCommentOnly) queryParams.set('hasCommentOnly', 'true');
    }

    const url = `/api/dashboard/issue-comments?${queryParams.toString()}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.comments)) {
          setFetchedComments(data.comments);
        } else {
          const matched = existingComments.filter(c => {
            if (targetIssue.type === 'general') {
              return c.general_issue_id === targetIssue.id || (c.general_issue_title && c.general_issue_title.includes(targetIssue.title));
            } else {
              return c.detailed_issue_id === targetIssue.id || (c.detailed_issue_title && c.detailed_issue_title.includes(targetIssue.title));
            }
          });
          setFetchedComments(matched);
        }
      })
      .catch(err => {
        console.error('Error fetching issue comments:', err);
        setFetchedComments([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, targetIssue, filters]);

  // Helper for Ukrainian stemming in local comment search
  const getUkrainianStem = (word: string): string => {
    let w = word.toLowerCase().trim();
    if (w.length <= 3) return w;
    w = w.replace(/(ами|ями|ях|ах|ів|їв|ей|ем|єм|ом|ові|еві|єю|ою|ий|ого|ому|им|их|ія|ію|ії|ям|ями|ій|ної|ний|ного|ному|ним|них|ні|ти|тися|ться|учи|ючи)$/g, '');
    if (w.length > 4) {
      w = w.replace(/(и|а|я|е|є|у|ю|і|ї|ь|о)$/g, '');
    }
    return w;
  };

  const matchUkrainianTerm = (textLower: string, term: string): boolean => {
    if (!term) return true;
    if (textLower.includes(term)) return true;
    const termStem = getUkrainianStem(term);
    if (termStem.length >= 3 && textLower.includes(termStem)) return true;
    return false;
  };

  // Filtered comments
  const filteredComments = useMemo(() => {
    return fetchedComments.filter(c => {
      // Search term
      if (searchTerm && searchTerm.trim().length > 0) {
        const q = searchTerm.trim().toLowerCase();
        const cleanQ = q.replace(/^[#№]\s*/, '').trim();
        const commentText = (c.processed_comment || c.comment || '').toLowerCase();
        const idStr = String(c.id);

        const terms = q.replace(/^[#№]\s*/, '').split(/\s+/).filter(Boolean);
        const matchText = terms.every(term => 
          matchUkrainianTerm(commentText, term) ||
          (cleanQ && idStr.includes(cleanQ))
        );
        if (!matchText) return false;
      }

      // Person type filter
      if (selectedPersonType !== 'all') {
        if (c.persontype !== selectedPersonType) return false;
      }

      // Score filter
      if (selectedScoreCat === 'negative' && c.score > 6) return false;
      if (selectedScoreCat === 'neutral' && (c.score < 7 || c.score > 8)) return false;
      if (selectedScoreCat === 'positive' && c.score < 9) return false;

      return true;
    });
  }, [fetchedComments, searchTerm, selectedPersonType, selectedScoreCat]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredComments.length / pageSize));
  const pagedComments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredComments.slice(start, start + pageSize);
  }, [filteredComments, currentPage, pageSize]);

  if (!isOpen || !targetIssue) return null;

  const getPersonTypeBadge = (pt: string) => {
    if (pt === '2') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
          <User className="w-3 h-3 text-blue-600" />
          ФОП
        </span>
      );
    }
    if (pt === '1') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
          <Building2 className="w-3 h-3 text-teal-600" />
          Юридична особа
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        Тип невідомий
      </span>
    );
  };

  return (
    <div className={
      isMobileSimulator
        ? "absolute inset-0 z-50 bg-slate-900/85 backdrop-blur-xs flex flex-col justify-end overflow-hidden animate-fadeIn"
        : "fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fadeIn"
    }>
      <div className={
        isMobileSimulator
          ? "bg-white w-full h-full max-h-full flex flex-col shadow-2xl overflow-hidden"
          : "bg-white rounded-t-3xl sm:rounded-2xl max-w-4xl w-full h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
      }>
        
        {/* Header */}
        <div className="p-3.5 sm:p-5 bg-slate-900 text-white flex flex-col gap-2.5 border-b border-slate-800 shrink-0">
          {/* Mobile Handle Indicator */}
          <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto sm:hidden -mt-0.5 mb-1" />

          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="p-2 sm:p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0 mt-0.5">
                <MessageSquare className="w-4 h-4 sm:w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wide">
                    {targetIssue.type === 'general' ? 'Загальна проблема' : 'Сигнал'} #{targetIssue.id}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {fetchedComments.length.toLocaleString()} коментарів
                  </span>
                  {filters?.selectedHromada && (
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-amber-400" />
                      Громада: {filters.selectedHromadaName || filters.selectedHromada}
                    </span>
                  )}
                  {filters?.selectedRegion && filters.selectedRegion !== 'all' && (
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      Регіон: {filters.selectedRegion}
                    </span>
                  )}
                  {filters?.region && filters.region !== 'all' && !filters.selectedRegion && (
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      Регіон: {filters.region}
                    </span>
                  )}
                </div>
                <h2 className="text-sm sm:text-lg font-extrabold text-white mt-1 leading-snug break-words">
                  {targetIssue.title}
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer shrink-0"
              title="Закрити модальне вікно"
            >
              <X className="w-4 h-4 sm:w-5 h-5" />
            </button>
          </div>

          {/* Mechanism text */}
          <div className="bg-slate-800/80 p-2 sm:p-2.5 rounded-xl border border-slate-700/80 text-[11px] sm:text-xs text-slate-200 leading-relaxed max-h-20 sm:max-h-none overflow-y-auto">
            <span className="text-blue-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Опис:</span>
            {targetIssue.mechanism}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-2.5 sm:p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shrink-0">
          {/* Stats & Person Type Segmented Control */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="font-extrabold text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs text-[10px] sm:text-xs whitespace-nowrap">
                Знайдено: {filteredComments.length.toLocaleString()}
              </span>

              {/* Filter Person Type in Mobile (takes full width) */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg font-bold flex-1 sm:flex-initial">
                <button
                  onClick={() => { setSelectedPersonType('all'); setCurrentPage(1); }}
                  className={`flex-1 sm:flex-initial px-2 py-1 rounded-md text-[10px] sm:text-[11px] transition-all cursor-pointer text-center ${
                    selectedPersonType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Всі
                </button>
                <button
                  onClick={() => { setSelectedPersonType('2'); setCurrentPage(1); }}
                  className={`flex-1 sm:flex-initial px-2 py-1 rounded-md text-[10px] sm:text-[11px] transition-all cursor-pointer text-center ${
                    selectedPersonType === '2' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ФОП
                </button>
                <button
                  onClick={() => { setSelectedPersonType('1'); setCurrentPage(1); }}
                  className={`flex-1 sm:flex-initial px-2 py-1 rounded-md text-[10px] sm:text-[11px] transition-all cursor-pointer text-center ${
                    selectedPersonType === '1' ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Юр. особи
                </button>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-60 block">
            <Search className="w-3.5 h-3.5 text-blue-600 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="🔍 Пошук у тексті або області..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium shadow-2xs"
            />
          </div>
        </div>

        {/* Comments Cards Body */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2 sm:space-y-3 bg-slate-100/60">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="font-bold text-slate-700 text-xs">Завантаження коментарів з бази PostgreSQL PULS_COPY...</p>
            </div>
          ) : filteredComments.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 p-6">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="font-bold text-slate-700 text-sm">Коментарів за вказаним фільтром не знайдено</p>
              <p className="text-xs text-slate-500 mt-1">Спробуйте змінити або скинути пошуковий запит.</p>
            </div>
          ) : (
            pagedComments.map((comment) => (
              <div
                key={comment.id}
                className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 transition-all space-y-2"
              >
                {/* Meta Row */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b pb-2 border-slate-100 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {/* Score Badge */}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-black border flex items-center gap-1 ${
                      comment.score >= 9
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : comment.score >= 7
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                      {comment.score} / 10
                    </span>

                    {/* Person Type Badge */}
                    {getPersonTypeBadge(comment.persontype)}

                    {/* Oblast Badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-500" />
                      {comment.oblast || 'Україна'}
                    </span>
                  </div>

                  {/* Created At Timestamp */}
                  <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-slate-400 ml-auto sm:ml-0">
                    <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
                    <span>{comment.created_at}</span>
                  </div>
                </div>

                {/* Comment Content (processed_comment) */}
                <div className="text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50/90 p-2.5 sm:p-3 rounded-lg border border-slate-100 font-sans break-words">
                  «{comment.processed_comment || comment.comment}»
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="p-2.5 sm:p-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
              Джерело: база даних <code className="text-blue-700 font-mono font-bold">{databaseName || 'PULS_COPY'}</code>
            </span>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="font-bold text-slate-800 text-[10px] sm:text-xs whitespace-nowrap">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 sm:py-1.5 rounded-xl sm:rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer text-center"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
