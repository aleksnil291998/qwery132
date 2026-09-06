/* ============================================================
 * Учёт FPV-дронов 7 мотострелкового батальона.
 * Аналог Excel-файла: лист «Подробно» (детальный учёт),
 * шаблон «Эскиз» и готовые отчёты-листы dd.MM.yyyy с архивом.
 * Все данные хранятся локально в localStorage, сервер не нужен.
 * ============================================================ */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Archive, BookOpen, CheckCircle2, ClipboardList,
  Download, Table2, Upload,
} from 'lucide-react';
import type { Dicts, DroneRecord, Report } from './logic';
import {
  buildReport, downloadFile, exportAllJSON, formatDateKey,
  loadDicts, loadRecords, loadReports, parseImportJSON, persist, statsOf,
} from './logic';
import DetailTable from './components/DetailTable';
import { ArchiveView, ReportPaper, ReportView } from './components/ReportView';
import Dictionaries from './components/Dictionaries';

type Tab = 'detail' | 'report' | 'archive' | 'dicts';

/* ---------- Плавный «набег» чисел на панели сводки ---------- */
function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const from = prevRef.current;
    if (from === target) return;
    prevRef.current = target;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ---------- Декоративный радар панели сводки ---------- */
function Radar() {
  return (
    <div className="relative hidden h-24 w-24 shrink-0 sm:block" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="absolute inset-0 text-line2">
        <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M50 3v94M3 50h94" stroke="currentColor" strokeWidth="0.8" />
      </svg>
      <div className="absolute inset-[3px] overflow-hidden rounded-full">
        <div
          className="animate-radar absolute inset-0"
          style={{ background: 'conic-gradient(from 0deg, rgba(240,180,41,0.5), rgba(240,180,41,0.07) 70deg, transparent 95deg)' }}
        />
      </div>
      {/* «Цели» на радаре */}
      <span className="animate-blip absolute top-[22%] left-[62%] h-1.5 w-1.5 rounded-full bg-ready shadow-[0_0_8px_rgba(143,191,106,0.9)]" />
      <span className="animate-blip absolute top-[58%] left-[28%] h-1.5 w-1.5 rounded-full bg-amber shadow-[0_0_8px_rgba(240,180,41,0.9)]" style={{ animationDelay: '0.9s' }} />
      <span className="animate-blip absolute top-[70%] left-[66%] h-1.5 w-1.5 rounded-full bg-alert shadow-[0_0_8px_rgba(224,106,74,0.9)]" style={{ animationDelay: '1.7s' }} />
      <span className="absolute top-1/2 left-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber" />
    </div>
  );
}

/* ---------- Элемент панели сводки ---------- */
function Stat({ label, value, total, color, bar }: {
  label: string; value: number; total: number; color: string; bar: string;
}) {
  const shown = useCountUp(value);
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">{label}</p>
      <p className={`font-mono text-[26px] leading-tight font-bold ${color}`}>{shown}</p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line/60">
        <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- Всплывающие уведомления ---------- */
interface Toast { id: number; kind: 'ok' | 'err'; text: string; }

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(toast.id), 3600);
    return () => clearTimeout(t);
  }, [toast.id, onDone]);
  return (
    <div className={`animate-toastin pointer-events-auto flex items-center gap-2.5 rounded-md border px-4 py-3 text-sm font-medium shadow-xl shadow-black/50 ${
      toast.kind === 'ok'
        ? 'border-ready/40 bg-[#1b2413] text-[#cde7b2]'
        : 'border-alert/40 bg-[#2a1712] text-[#f5c4b3]'
    }`}>
      {toast.kind === 'ok' ? <CheckCircle2 size={17} className="shrink-0 text-ready" /> : <AlertCircle size={17} className="shrink-0 text-alert" />}
      {toast.text}
    </div>
  );
}

/* ============================================================
 * Корневой компонент
 * ============================================================ */
export default function App() {
  const [records, setRecords] = useState<DroneRecord[]>(loadRecords);
  const [dicts, setDicts] = useState<Dicts>(loadDicts);
  const [reports, setReports] = useState<Report[]>(loadReports);
  const [tab, setTab] = useState<Tab>('detail');
  const [activeKey, setActiveKey] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [clock, setClock] = useState(() => new Date());
  const fileRef = useRef<HTMLInputElement>(null);

  /* Сохранение в localStorage при любом изменении данных */
  useEffect(() => { persist(records, dicts, reports); }, [records, dicts, reports]);

  /* Живые часы в шапке */
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const toast = (kind: 'ok' | 'err', text: string) =>
    setToasts((ts) => [...ts.slice(-3), { id: Date.now() + Math.random(), kind, text }]);

  const stats = useMemo(() => statsOf(records), [records]);
  const activeReport = useMemo(
    () => [...reports].sort((a, b) => b.createdAt - a.createdAt).find((r) => r.dateKey === activeKey) ?? null,
    [reports, activeKey],
  );

  /* «Сформировать отчёт» за текущую дату (аналог запуска макроса) */
  const generate = () => {
    if (records.length === 0) {
      toast('err', 'Нет записей — сначала заполните детальный учёт');
      return;
    }
    const rep = buildReport(records);
    setReports((prev) => [...prev.filter((r) => r.dateKey !== rep.dateKey), rep]);
    setActiveKey(rep.dateKey);
    setTab('report');
    toast('ok', `Отчёт за ${rep.dateKey} сформирован и сохранён в архив`);
  };

  /* Экспорт/импорт всех данных в JSON */
  const exportJSON = () => {
    downloadFile(`fpv-drones-data-${formatDateKey(new Date())}.json`, exportAllJSON(records, dicts, reports), 'application/json');
    toast('ok', 'Данные выгружены в JSON-файл');
  };
  const importJSON = async (file: File) => {
    try {
      const data = parseImportJSON(await file.text());
      setRecords(data.records);
      setDicts(data.dicts);
      setReports(data.reports);
      setActiveKey('');
      toast('ok', `Импортировано: ${data.records.length} записей, ${data.reports.length} отчётов`);
    } catch (e) {
      toast('err', e instanceof Error ? e.message : 'Не удалось прочитать файл');
    }
  };

  /* CRUD детальных записей */
  const saveRecord = (rec: DroneRecord) => {
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === rec.id);
      return exists ? prev.map((r) => (r.id === rec.id ? rec : r)) : [...prev, rec];
    });
    toast('ok', 'Запись сохранена');
  };
  const deleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    toast('ok', 'Запись удалена');
  };

  const deleteReport = (dateKey: string) => {
    setReports((prev) => prev.filter((r) => r.dateKey !== dateKey));
    if (activeKey === dateKey) setActiveKey('');
    toast('ok', `Отчёт за ${dateKey} удалён из архива`);
  };

  const tabs: { id: Tab; label: string; icon: typeof Table2; count?: number }[] = [
    { id: 'detail', label: 'Подробно', icon: Table2, count: records.length },
    { id: 'report', label: 'Отчёт', icon: ClipboardList },
    { id: 'archive', label: 'Архив', icon: Archive, count: reports.length },
    { id: 'dicts', label: 'Справочники', icon: BookOpen },
  ];

  return (
    <>
      <div className="app-shell bg-ops min-h-screen">
        {/* ================= ШАПКА ================= */}
        <header className="sticky top-0 z-40 border-b border-line bg-moss/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 pb-2 sm:px-6">
            {/* Эмблема */}
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-amber/40 bg-amber/10 shadow-[0_0_22px_rgba(240,180,41,0.15)]">
                <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
                  <g stroke="#f0b429" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M9.5 9.5l5 5M22.5 9.5l-5 5M9.5 22.5l5-5M22.5 22.5l-5-5" />
                  </g>
                  <circle cx="16" cy="16" r="3.2" fill="#f0b429" />
                  <g fill="none" stroke="#f0b429" strokeWidth="2">
                    <circle cx="7.5" cy="7.5" r="3" /><circle cx="24.5" cy="7.5" r="3" />
                    <circle cx="7.5" cy="24.5" r="3" /><circle cx="24.5" cy="24.5" r="3" />
                  </g>
                </svg>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-[17px] leading-none tracking-wider text-khaki">УЧЁТ FPV-ДРОНОВ</h1>
                  <span className="rounded border border-amber/50 bg-amber/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber">7 МСБ</span>
                </div>
                <p className="mt-1 hidden text-[11px] leading-tight text-faint md:block">
                  Данные по наличию FPV дронов в 7 мотострелковом батальоне (на автомобилях)
                </p>
              </div>
            </div>

            {/* Часы */}
            <div className="ml-auto hidden text-right lg:block">
              <p className="font-mono text-lg leading-none font-bold text-khaki tabular-nums">
                {String(clock.getHours()).padStart(2, '0')}:{String(clock.getMinutes()).padStart(2, '0')}
                <span className="animate-blinker text-amber">:</span>{String(clock.getSeconds()).padStart(2, '0')}
              </p>
              <p className="mt-0.5 font-mono text-[10px] tracking-widest text-faint">{formatDateKey(clock)}</p>
            </div>

            {/* Кнопки данных */}
            <div className="ml-auto flex items-center gap-2 lg:ml-4">
              <button className="btn !px-2.5" title="Экспорт всех данных в JSON" onClick={exportJSON}>
                <Download size={15} /><span className="hidden sm:inline">JSON</span>
              </button>
              <button className="btn !px-2.5" title="Импорт данных из JSON" onClick={() => fileRef.current?.click()}>
                <Upload size={15} /><span className="hidden sm:inline">Импорт</span>
              </button>
              <input
                ref={fileRef} type="file" accept=".json,application/json" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importJSON(f);
                  e.target.value = '';
                }}
              />
              <button className="btn btn-amber" onClick={generate}>
                <ClipboardList size={15} /> Сформировать отчёт
              </button>
            </div>
          </div>

          {/* Вкладки */}
          <nav className="mx-auto flex max-w-[1400px] gap-1.5 overflow-x-auto px-4 pb-2.5 sm:px-6">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3.5 py-2 text-[13px] font-semibold transition-all duration-150 active:scale-[0.97] ${
                    active
                      ? 'border-amber/50 bg-panel2 text-amber shadow-[inset_0_-2px_0_rgba(240,180,41,0.55)]'
                      : 'border-transparent text-dim hover:border-line hover:bg-panel2/60 hover:text-khaki'
                  }`}
                >
                  <Icon size={15} />
                  {t.label}
                  {typeof t.count === 'number' && (
                    <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none font-bold ${active ? 'bg-amber/20 text-amber' : 'bg-line/50 text-dim'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </header>

        {/* ================= ПАНЕЛЬ СВОДКИ ================= */}
        <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6">
          <div className="panel flex items-center gap-2 overflow-hidden">
            <div className="flex items-center gap-4 border-r border-line/70 py-3 pr-4 pl-4">
              <Radar />
              <div className="sm:hidden">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">Оперативная сводка</p>
                <p className="font-mono text-2xl font-bold text-khaki">{stats.total}</p>
              </div>
              <div className="hidden sm:block">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ready" />
                  Оперативная сводка
                </p>
                <p className="mt-1 font-display text-sm tracking-widest text-khaki">ПАРК БПЛА</p>
                <p className="mt-0.5 font-mono text-[11px] text-faint">обновлено {formatDateKey(clock)}</p>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2 divide-x divide-line/50 sm:grid-cols-3 xl:grid-cols-6">
              <Stat label="Всего" value={stats.total} total={stats.total} color="text-khaki" bar="bg-khaki/70" />
              <Stat label="В наличии" value={stats.inStock} total={stats.total} color="text-ready" bar="bg-ready" />
              <Stat label="Готовы" value={stats.ready} total={stats.total} color="text-bluish" bar="bg-bluish" />
              <Stat label="НС частот" value={stats.nsu} total={stats.total} color="text-nsu" bar="bg-nsu" />
              <Stat label="Не исправно" value={stats.broken} total={stats.total} color="text-alert" bar="bg-alert" />
              <Stat label="Боевая работа" value={stats.combat} total={stats.total} color="text-[#ff9d7e]" bar="bg-alertdeep" />
            </div>
          </div>
        </div>

        {/* ================= КОНТЕНТ ВКЛАДКИ ================= */}
        <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6" key={tab}>
          {tab === 'detail' && (
            <DetailTable records={records} dicts={dicts} onSave={saveRecord} onDelete={deleteRecord} />
          )}
          {tab === 'report' && (
            <ReportView report={activeReport} hasRecords={records.length > 0} onGenerate={generate} />
          )}
          {tab === 'archive' && (
            <ArchiveView
              reports={reports}
              onOpen={(k) => { setActiveKey(k); setTab('report'); }}
              onDelete={deleteReport}
            />
          )}
          {tab === 'dicts' && (
            <Dictionaries dicts={dicts} records={records} onChange={setDicts} />
          )}
        </main>

        {/* ================= ПОДВАЛ ================= */}
        <footer className="mx-auto max-w-[1400px] px-4 pb-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-4 text-[11px] text-faint">
            <span>
              Аналог Excel-файла: листы «Подробно» и «Эскиз», отчёты <span className="font-mono">dd.MM.yyyy</span> • подсчёт по логике VBA-макроса
            </span>
            <span>Данные хранятся локально в браузере (localStorage) — сервер не используется</span>
          </div>
        </footer>
      </div>

      {/* Область печати: при «Печать / PDF» выводится только бланк отчёта */}
      <div id="print-area">
        {activeReport && <ReportPaper report={activeReport} />}
      </div>

      {/* Уведомления */}
      <div className="toast-root pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={(id) => setToasts((ts) => ts.filter((x) => x.id !== id))} />
        ))}
      </div>
    </>
  );
}
