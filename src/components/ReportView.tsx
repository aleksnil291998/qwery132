/* ============================================================
 * Вкладка «Отчёт» — бланк по шаблону «Эскиз» и архив отчётов.
 * Цвета бланка по описанию: «В наличии» — зелёный,
 * «Готовы»/«У кого находятся» — синий, блок «Не готовы» — бежевый,
 * НСУ — жёлтый, «Не исправен»/«Боевая работа» — красный.
 * ============================================================ */

import { useEffect, useState } from 'react';
import { Archive, ClipboardList, Eye, FileSpreadsheet, Printer, RefreshCw, Trash2 } from 'lucide-react';
import type { Report, ReportRow } from '../logic';
import { downloadFile, formatDateTime, reportToCSV } from '../logic';

/* ---------- Бланк отчёта (экран + печать) ---------- */

export function ReportPaper({ report }: { report: Report }) {
  const section = (title: string, rows: ReportRow[], startNo: number) => (
    rows.length > 0 && (
      <>
        <tr>
          <td colSpan={11} className="bg-[#d7dfc4] py-1.5 text-center text-[13px] font-bold tracking-wide uppercase">{title}</td>
        </tr>
        {rows.map((r, i) => (
          <tr key={`${title}-${r.name}`}>
            <td className="paper-num w-[46px]">{startNo + i}.</td>
            <td className="min-w-[130px] font-semibold">{r.name}</td>
            <td className="paper-num w-[70px]">{r.received}</td>
            <td className="paper-num w-[76px] bg-[#e6f2dc]">{r.inStock}</td>
            <td className="paper-num w-[86px] bg-[#e3ecf6] text-[#2b5a8c]">{r.ready}</td>
            <td className="min-w-[150px] text-[12px] leading-snug font-medium whitespace-pre-line text-[#33537d]">{r.holders}</td>
            <td className="paper-num w-[58px] bg-[#f4ecd6]">{r.notReadyTotal}</td>
            <td className="paper-num w-[58px] bg-[#fdf2c5]">{r.nsu}</td>
            <td className="paper-num w-[70px] bg-[#fbe2db]">{r.brokenInStock}</td>
            <td className="paper-num w-[70px] bg-[#fbe2db]">{r.brokenOutOfStock}</td>
            <td className="paper-num w-[76px] bg-[#f6d3c7]">{r.combat}</td>
          </tr>
        ))}
      </>
    )
  );

  const totalRow = (r: ReportRow, strong = false) => (
    <tr className={strong ? 'bg-[#ccd4b8] font-bold' : 'bg-[#e6e9d6] font-semibold'}>
      <td colSpan={2} className="px-3 text-left tracking-wide uppercase">{r.name}</td>
      <td className="paper-num">{r.received}</td>
      <td className="paper-num bg-[#dcedd0]">{r.inStock}</td>
      <td className="paper-num bg-[#d9e6f2] text-[#2b5a8c]">{r.ready}</td>
      <td className="text-[12px] leading-snug font-semibold whitespace-pre-line text-[#33537d]">{r.holders}</td>
      <td className="paper-num bg-[#efe5c8]">{r.notReadyTotal}</td>
      <td className="paper-num bg-[#fbeeb9]">{r.nsu}</td>
      <td className="paper-num bg-[#f8d9d1]">{r.brokenInStock}</td>
      <td className="paper-num bg-[#f8d9d1]">{r.brokenOutOfStock}</td>
      <td className="paper-num bg-[#f3c9ba]">{r.combat}</td>
    </tr>
  );

  return (
    <div className="paper rounded-lg border border-[#c8ccae] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] sm:p-7">
      {/* Шапка бланка */}
      <p className="text-center text-[15px] leading-snug font-bold uppercase sm:text-[17px]">
        Данные по наличию FPV дронов в 7 мотострелковом батальоне (на автомобилях)
      </p>
      <p className="mt-1 text-center font-mono text-[12px] text-[#6c7160]">
        отчёт от {report.dateKey} &nbsp;•&nbsp; сформирован {formatDateTime(report.createdAt)}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="paper-table w-full min-w-[960px] text-[13px]">
          <thead>
            <tr className="text-center text-[11px] uppercase">
              <th rowSpan={2} className="w-[46px] bg-[#d0d4bd]">№ п/п</th>
              <th rowSpan={2} className="bg-[#d0d4bd]">Наименование</th>
              <th rowSpan={2} className="w-[70px] bg-[#d0d4bd]">Получено</th>
              <th rowSpan={2} className="w-[76px] bg-[#77b26b] text-white">В наличии</th>
              <th rowSpan={2} className="w-[86px] bg-[#4f81bd] text-white">Готовы к применению</th>
              <th rowSpan={2} className="w-[150px] bg-[#4f81bd] text-white">У кого находятся</th>
              <th colSpan={5} className="bg-[#f0e2bf] text-[#5d4a1c]">Не готовы к применению</th>
            </tr>
            <tr className="text-center text-[11px] uppercase">
              <th className="w-[58px] bg-[#f0e2bf] text-[#5d4a1c]">Всего</th>
              <th className="w-[58px] bg-[#ffd966]">НСУ</th>
              <th className="w-[70px] bg-[#e06666] text-white">Не исправен (в наличии)</th>
              <th className="w-[70px] bg-[#e06666] text-white">Не исправен (не в наличии)</th>
              <th className="w-[76px] bg-[#cc4125] text-white">Боевая работа</th>
            </tr>
          </thead>
          <tbody>
            {section('Дневные FPV дроны', report.dayRows, 1)}
            {section('Ночные FPV дроны', report.nightRows, 1)}
            <tr>
              <td colSpan={11} className="bg-[#c3c9ac] py-1 text-center text-[12px] font-bold tracking-[0.2em] uppercase">Итого</td>
            </tr>
            {totalRow(report.dayTotals)}
            {report.nightTotals && totalRow(report.nightTotals)}
            {totalRow(report.grandTotals, true)}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-right font-mono text-[11px] text-[#8b907c]">
        НСУ — не стандартная частота управления • лист «{report.dateKey}»
      </p>
    </div>
  );
}

/* ---------- Вкладка «Отчёт» ---------- */

export function ReportView({
  report, hasRecords, onGenerate,
}: {
  report: Report | null;
  hasRecords: boolean;
  onGenerate: () => void;
}) {
  const exportCSV = (rep: Report) =>
    downloadFile(`fpv-otchet-${rep.dateKey}.csv`, reportToCSV(rep), 'text/csv;charset=utf-8');

  if (!report) {
    return (
      <section className="animate-rise panel flex flex-col items-center gap-4 px-6 py-20 text-center">
        <ClipboardList size={44} className="text-faint" />
        <div>
          <p className="font-display text-base tracking-widest text-dim uppercase">Отчёт ещё не сформирован</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-faint">
            Нажмите кнопку ниже — по данным детального учёта будет собран отчёт за текущую дату
            и сохранён в архив под именем <span className="font-mono text-dim">dd.MM.yyyy</span>.
          </p>
        </div>
        <button className="btn btn-amber" onClick={onGenerate} disabled={!hasRecords}>
          <ClipboardList size={16} /> Сформировать отчёт
        </button>
        {!hasRecords && <p className="text-xs text-faint">Сначала добавьте записи на вкладке «Подробно».</p>}
      </section>
    );
  }

  return (
    <section className="animate-rise">
      <div className="panel mb-4 flex flex-wrap items-center gap-2 p-3.5">
        <div className="mr-auto flex items-center gap-3 px-1">
          <span className="font-display text-lg tracking-wider text-amber">{report.dateKey}</span>
          <span className="hidden text-xs text-faint sm:inline">сформирован {formatDateTime(report.createdAt)}</span>
        </div>
        <button className="btn" onClick={onGenerate} title="Пересобрать отчёт по текущим данным">
          <RefreshCw size={15} /> Сформировать заново
        </button>
        <button className="btn" onClick={() => exportCSV(report)}>
          <FileSpreadsheet size={15} /> Excel / CSV
        </button>
        <button className="btn btn-amber" onClick={() => window.print()}>
          <Printer size={15} /> Печать / PDF
        </button>
      </div>

      <ReportPaper report={report} />
    </section>
  );
}

/* ---------- Вкладка «Архив» ---------- */

export function ArchiveView({
  reports, onOpen, onDelete,
}: {
  reports: Report[];
  onOpen: (dateKey: string) => void;
  onDelete: (dateKey: string) => void;
}) {
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmKey) return;
    const t = setTimeout(() => setConfirmKey(null), 3000);
    return () => clearTimeout(t);
  }, [confirmKey]);

  const sorted = [...reports].sort((a, b) => b.createdAt - a.createdAt);

  if (sorted.length === 0) {
    return (
      <section className="animate-rise panel flex flex-col items-center gap-3 px-6 py-20 text-center">
        <Archive size={40} className="text-faint" />
        <p className="font-display text-sm tracking-widest text-dim uppercase">Архив пуст</p>
        <p className="max-w-sm text-sm text-faint">
          Каждый сформированный отчёт сохраняется здесь под датой формирования — как отдельный лист Excel-файла.
        </p>
      </section>
    );
  }

  return (
    <section className="animate-rise grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((rep, i) => (
        <article
          key={rep.dateKey + rep.createdAt}
          className="panel animate-rise group flex flex-col p-4 transition-colors duration-150 hover:border-line2 hover:bg-panel2/60"
          style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-xl tracking-wider text-khaki">{rep.dateKey}</p>
              <p className="mt-0.5 text-[11px] text-faint">сформирован {formatDateTime(rep.createdAt)}</p>
            </div>
            <span className="rounded border border-amber/30 bg-amber/10 px-2 py-1 font-mono text-[11px] font-semibold text-amber">
              лист Excel
            </span>
          </div>

          {/* Мини-сводка отчёта */}
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Получено', value: rep.grandTotals.received, color: 'text-khaki' },
              { label: 'В наличии', value: rep.grandTotals.inStock, color: 'text-ready' },
              { label: 'Готовы', value: rep.grandTotals.ready, color: 'text-bluish' },
              { label: 'Не готовы', value: rep.grandTotals.notReadyTotal, color: 'text-alert' },
            ].map((s) => (
              <div key={s.label} className="rounded border border-line/70 bg-moss px-1 py-2">
                <p className={`font-mono text-lg leading-none font-bold ${s.color}`}>{s.value}</p>
                <p className="mt-1 text-[10px] tracking-wide text-faint uppercase">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-dim">
            {rep.dayRows.length + rep.nightRows.length} наим. •
            день: {rep.dayRows.length}{rep.nightTotals ? ` • ночь: ${rep.nightRows.length}` : ''}
          </p>

          <div className="mt-4 flex gap-2 border-t border-line/70 pt-3">
            <button className="btn flex-1" onClick={() => onOpen(rep.dateKey)}><Eye size={14} /> Открыть</button>
            <button
              className="btn !px-2.5"
              title="Скачать CSV"
              onClick={() => downloadFile(`fpv-otchet-${rep.dateKey}.csv`, reportToCSV(rep), 'text/csv;charset=utf-8')}
            >
              <FileSpreadsheet size={14} />
            </button>
            {confirmKey === rep.dateKey ? (
              <button className="btn btn-danger !px-2.5 !text-xs" onClick={() => { onDelete(rep.dateKey); setConfirmKey(null); }}>
                Точно?
              </button>
            ) : (
              <button className="btn btn-ghost !border-line !px-2.5 hover:!border-alert/50 hover:!text-alert"
                title="Удалить из архива" onClick={() => setConfirmKey(rep.dateKey)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
