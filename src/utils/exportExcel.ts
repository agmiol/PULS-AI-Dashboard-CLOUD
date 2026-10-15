import ExcelJS from 'exceljs';
import { DashboardData } from '../types';

export async function exportCalibrationAuditToExcel(data: DashboardData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Платформа ПУЛЬС / PULSE.GOV.UA';
  workbook.created = new Date();

  // --------------------------------------------------------------------------
  // SHEET 1: ЗАГАЛЬНІ ПРОБЛЕМИ (General Issues)
  // --------------------------------------------------------------------------
  const sheetGeneral = workbook.addWorksheet('Загальні проблеми (General)', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheetGeneral.columns = [
    { header: 'ID Загальної проблеми', key: 'generalIssueId', width: 22 },
    { header: 'Назва загальної проблеми', key: 'issueTitle', width: 45 },
    { header: 'Системний механізм / Опис', key: 'mechanism', width: 55 },
    { header: 'Всього згадок (Усі часи)', key: 'totalMentions', width: 24 },
    { header: 'Частка від загалу (%)', key: 'sharePercent', width: 22 },
    { header: 'Кількість місяців (N)', key: 'monthsCount', width: 20 },
    { header: 'Схил Theil-Sen β (в.п./міс)', key: 'trendSlope', width: 26 },
    { header: 'Прогноз на 6 міс Δ6 (в.п.)', key: 'delta6', width: 26 },
    { header: 'Шум залишків robustNoise (MAD)', key: 'robustNoise', width: 30 },
    { header: 'Показник тренду S_trend (сигнал/шум)', key: 'sTrend', width: 34 },
    { header: 'Результуючий напрям тренду V3', key: 'trendDirection', width: 28 },
    { header: 'Сила тренду V3 (Strength)', key: 'trendStrength', width: 24 },
    { header: 'Оперативний приріст Δ_recent (в.п.)', key: 'deltaRecent', width: 32 },
    { header: 'Базовий шум σ_B', key: 'sigmaB', width: 22 },
    { header: 'Показник сплеску S_recent', key: 'sRecent', width: 26 },
    { header: 'Сплеск активності V3 (Spike)', key: 'activitySpike', width: 26 },
    { header: 'Сигнал зростання V3 (Rising Signal)', key: 'risingSignal', width: 30 },
    { header: 'Теги сфери (Scope Tags)', key: 'scopeTags', width: 35 }
  ];

  // Map growing & declining stats for quick lookup
  const trendItemMap = new Map<number, any>();
  [...data.growingIssues, ...data.decliningIssues].forEach(item => {
    trendItemMap.set(item.generalIssueId, item);
  });

  data.fullGeneralIssues.forEach(item => {
    const trendStats = trendItemMap.get(item.generalIssueId);

    const slope = item.trendSlope ?? trendStats?.trendSlope ?? null;
    const monthsCount = item.monthsCount ?? trendStats?.monthsCount ?? null;
    const delta6 = item.delta6 ?? trendStats?.delta6 ?? null;
    const robustNoise = item.robustNoise ?? trendStats?.robustNoise ?? null;
    const sTrend = item.sTrend ?? trendStats?.sTrend ?? null;
    const deltaRecent = item.deltaRecent ?? trendStats?.deltaRecent ?? null;
    const sigmaB = item.sigmaB ?? trendStats?.sigmaB ?? null;
    const sRecent = item.sRecent ?? trendStats?.sRecent ?? null;
    const hasSpike = Boolean(item.hasActivitySpike || trendStats?.hasActivitySpike);

    sheetGeneral.addRow({
      generalIssueId: item.generalIssueId,
      issueTitle: item.issueTitle,
      mechanism: item.mechanism,
      totalMentions: item.totalMentions,
      sharePercent: Number(((item.shareRatio || 0) * 100).toFixed(2)),
      monthsCount: monthsCount,
      trendSlope: slope != null ? Number(slope.toFixed(4)) : null,
      delta6: delta6,
      robustNoise: robustNoise,
      sTrend: sTrend,
      trendDirection: item.trendDirection || 'без тренду',
      trendStrength: item.trendStrength || 'відсутня',
      deltaRecent: deltaRecent,
      sigmaB: sigmaB,
      sRecent: sRecent,
      activitySpike: hasSpike ? 'Так' : 'Ні',
      risingSignal: item.risingSignal || 'немає',
      scopeTags: Array.isArray(item.scopeTags) ? item.scopeTags.join(', ') : ''
    });
  });

  // --------------------------------------------------------------------------
  // SHEET 2: ДЕТАЛІЗОВАНІ МЕХАНІЗМИ (Detailed Issues / Signals)
  // --------------------------------------------------------------------------
  const sheetDetailed = workbook.addWorksheet('Деталізовані механізми (Detailed)', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheetDetailed.columns = [
    { header: 'ID Деталізованої проблеми', key: 'detailedIssueId', width: 25 },
    { header: 'ID Материнської загальної', key: 'parentGeneralIssueId', width: 25 },
    { header: 'Материнська загальна проблема', key: 'generalIssueTitle', width: 40 },
    { header: 'Конкретна точкова проблема (Title)', key: 'issueTitle', width: 45 },
    { header: 'Конкретний механізм (Mechanism)', key: 'mechanism', width: 55 },
    { header: 'Всього згадок за період (N_period)', key: 'totalMentions', width: 30 },
    { header: 'Всього згадок за весь час (N_alltime)', key: 'totalAllTime', width: 30 },
    { header: 'Частка у загалі (%)', key: 'sharePercent', width: 22 },
    { header: 'Кількість місяців (N)', key: 'monthsCount', width: 20 },
    { header: 'Схил Theil-Sen β (в.п./міс)', key: 'slope', width: 28 },
    { header: 'Прогноз на 6 міс Δ6 (в.п.)', key: 'delta6', width: 26 },
    { header: 'Шум залишків robustNoise (MAD)', key: 'robustNoise', width: 30 },
    { header: 'Показник тренду S_trend (сигнал/шум)', key: 'sTrend', width: 34 },
    { header: 'Визначений тип тренду V3', key: 'trendType', width: 25 },
    { header: 'Визначена сила тренду V3', key: 'trendPower', width: 25 },
    { header: 'Сплеск активності V3 (Spike)', key: 'activitySpike', width: 26 },
    { header: 'Сигнал зростання V3 (Rising Signal)', key: 'risingSignal', width: 28 },
    { header: 'Новопостала проблема? (New)', key: 'isNewIssue', width: 26 },
    { header: 'Теги сфери', key: 'scopeTags', width: 35 }
  ];

  data.fullDetailedIssues.forEach(item => {
    sheetDetailed.addRow({
      detailedIssueId: item.detailedIssueId,
      parentGeneralIssueId: item.parentGeneralIssueId,
      generalIssueTitle: item.generalIssueTitle || '',
      issueTitle: item.issueTitle,
      mechanism: item.mechanism,
      totalMentions: item.totalMentions,
      totalAllTime: item.totalAllTime,
      sharePercent: Number(((item.shareRatio || 0) * 100).toFixed(2)),
      monthsCount: item.monthsCount ?? null,
      slope: item.slope != null ? Number(item.slope.toFixed(4)) : null,
      delta6: item.delta6 ?? null,
      robustNoise: item.robustNoise ?? null,
      sTrend: item.sTrend ?? null,
      trendType: item.trendType || 'без тренду',
      trendPower: item.trendPower || 'відсутня',
      activitySpike: item.activitySpike ? 'Так' : 'Ні',
      risingSignal: item.risingSignal || 'немає',
      isNewIssue: item.isNewIssue || 'Ні',
      scopeTags: Array.isArray(item.scopeTags) ? item.scopeTags.join(', ') : ''
    });
  });

  // --------------------------------------------------------------------------
  // SHEET 3: ОПИС МЕТОДОЛОГІЇ ТА КАЛІБРУВАННЯ (Updated Methodology V3)
  // --------------------------------------------------------------------------
  const sheetMeta = workbook.addWorksheet('Методологія V3 та параметри', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheetMeta.columns = [
    { header: 'Параметр / Показник', key: 'param', width: 38 },
    { header: 'Формула / Оновлена методика V3', key: 'value', width: 55 },
    { header: 'Призначення для ЛЛМ калібрувальника', key: 'desc', width: 70 }
  ];

  sheetMeta.addRow({
    param: 'Система аналітики',
    value: 'Платформа ПУЛЬС (PULSE.GOV.UA)',
    desc: 'Офіційний моніторинг скарг та пропозицій суб’єктів господарювання'
  });
  sheetMeta.addRow({
    param: 'Дата формування вивантаження',
    value: new Date().toLocaleString('uk-UA'),
    desc: 'Точна часова мітка створення звітного файлу audit_calibration'
  });
  sheetMeta.addRow({
    param: 'Згладжування часового ряду',
    value: '3-місячне рівноважне рухоме середнє (MA_3m)',
    desc: 'Усуває короткострокові місячні випадкові флуктуації та сезонний шум'
  });
  sheetMeta.addRow({
    param: 'Розрахунок схилу тренду (Theil-Sen Slope β)',
    value: 'β = median((Y_j - Y_i) / (X_j - X_i)) за x_indices, ma3m',
    desc: 'Робастна регресія Тейла-Сена (нечутлива до поодиноких сплесків та викидів)'
  });
  sheetMeta.addRow({
    param: 'Прогнозований приріст (Δ6)',
    value: 'Δ6 = 6 * β (в.п. за 6 місяців)',
    desc: 'Очікувана зміна частки проблеми у відсоткових пунктах за наступне півріччя'
  });
  sheetMeta.addRow({
    param: 'Оцінка рівня шуму (MAD Robust Noise)',
    value: 'robustNoise = 1.4826 * MAD(residuals), де residuals = Y - (α + β*X)',
    desc: 'Визначення природного розмаху випадкових коливань за медіанним абсолютним відхиленням'
  });
  sheetMeta.addRow({
    param: 'Сила тренду (S_trend)',
    value: 'S_trend = |Δ6| / robustNoise',
    desc: 'Відношення прогнозованого сигналу тренду до внутрішнього шуму часового ряду'
  });
  sheetMeta.addRow({
    param: 'Критерії стабільного тренду (Trend Direction)',
    value: 'N >= 15 міс. Спадаючий (β < 0, S_trend >= 0.75); Зростаючий (β > 0, S_trend >= 0.75); Без тренду (S_trend < 0.75)',
    desc: 'Класифікація напряму тренду: якщо сигнал менший за 0.75 шуму, зміна вважається статистично незначущою'
  });
  sheetMeta.addRow({
    param: 'Грейди сили тренду (Trend Strength)',
    value: 'Сильний (S_trend >= 1.50); Помірний (1.00 <= S_trend < 1.50); Слабкий (0.75 <= S_trend < 1.00)',
    desc: 'Категоризація достовірності та швидкості тренду'
  });
  sheetMeta.addRow({
    param: 'Сплеск активності V3 (Activity Spike)',
    value: 'Бінарний алерт (Так / Ні): C_recent >= 4, A_recent >= 2, Recency gate, Top-2 MA, ShareLift >= 2.0, CountLift >= 1.5',
    desc: 'Фіксація різкого оперативного зростання скарг за останні 3 місяці відносно 6-місячної базової лінії'
  });
  sheetMeta.addRow({
    param: 'Сигнал оперативного зростання V3 (Rising Signal)',
    value: 'Градації: Сильний, Помірний, Слабкий, Немає (за показниками приросту Lift, Recency gate та Top-2 MA)',
    desc: 'Рівень інтенсивності оперативного прискорення появи скарг за останні 90 днів'
  });

  // Apply styling (headers bold & background, borders, number formatting)
  [sheetGeneral, sheetDetailed, sheetMeta].forEach(sheet => {
    // Header style
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Dark slate background
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 28;

    // Data rows style
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: 'middle' };
        row.height = 20;

        // Subtle borders
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      }
    });
  });

  // Generate buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `PULSE_Trends_and_Signals_Calibration_Audit_${dateStr}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
