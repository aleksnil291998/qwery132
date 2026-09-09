/* ============================================================
 * Вкладка «Подробно» — детальный учёт (аналог листа Excel).
 * CRUD-записей, фильтры по наименованию/типу/состоянию/наличию,
 * поиск, цветовая кодировка ячеек по правилам исходного файла:
 *   C — зелёный/жёлтый/красный по состоянию,
 *   H — оранжевый при «Не в наличии», E/F — жёлтый при НС-частоте.
 * ============================================================ */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plane, Plus, Search, Trash2, X } from 'lucide-react';
import type { Condition, DayNight, Dicts, DroneRecord, Presence } from '../logic';
import { CONDITIONS, DAY_NIGHTS, PRESENCES, isControlStandard, isVideoStandard, uid } from '../logic';

interface Props {
  records: DroneRecord[];
  dicts: Dicts;
  onSave: (rec: DroneRecord) => void;
  onDelete: (id: string) => void;
}

/* Цвет ячейки «Наименование» по состоянию (колонка C исходного файла) */
const nameCellByCondition: Record<Condition, string> = {
  'Исправен': 'bg-ready/20 text-[#c4e5a4]',
  'Исправен/Не стандарт частот': 'bg-nsu/20 text-[#f2dfa0]',
  'Не исправен': 'bg-alert/20 text-[#f3c1b0]',
  'Боевое применение': 'bg-alertdeep/30 text-[#ffcdbb]',
};
const rowEdgeByCondition: Record<Condition, string> = {
  'Исправен': '#8fbf6a',
  'Исправен/Не стандарт частот': '#ecc94b',
  'Не исправен': '#e06a4a',
  'Боевое применение': '#c14a2e',
};
const badgeByCondition: Record<Condition, string> = {
  'Исправен': 'border-ready/40 bg-ready/10 text-ready',
  'Исправен/Не стандарт частот': 'border-nsu/40 bg-nsu/10 text-nsu',
  'Не исправен': 'border-alert/40 bg-alert/10 text-alert',
  'Боевое применение': 'border-alertdeep/50 bg-alertdeep/15 text-[#ff9d7e]',
};

const COND_SHORT: Record<Condition, string> = {
  'Исправен': 'Исправен',
  'Исправен/Не стандарт частот': 'НС частот',
  'Не исправен': 'Не исправен',
  'Боевое применение': 'Боевое прим.',
};

/* ---------- Модальное окно добавления/редактирования ---------- */

function RecordModal({
  initial, dicts, records, onClose, onSave,
}: {
  initial: DroneRecord | null;
  dicts: Dicts;
  records: DroneRecord[];
  onClose: () => void;
  onSave: (r: DroneRecord) => void;
}) {
  const [form, setForm] = useState<DroneRecord>(
    initial ?? {
      id: uid(), name: dicts.names[0] ?? 'Без наименования', dayNight: 'День',
      controlFreq: dicts.controlFreqs[0]?.value ?? '', videoFreq: dicts.videoFreqs[0]?.value ?? '',
      condition: 'Исправен', presence: 'В наличии', note: '', receivedBy: '', holder: '',
    },
  );
  const set = <K extends keyof DroneRecord>(k: K, v: DroneRecord[K]) => setForm((f) => ({ ...f, [k]: v }));

  /* Наименования: справочник + уже используемые в записях */
  const nameOptions = useMemo(() => {
    const set = new Set<string>([...dicts.names, ...records.map((r) => r.name)]);
    return [...set].filter(Boolean);
  }, [dicts.names, records]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const freqOptions = (items: { value: string; standard: boolean }[], current: string) => {
    const values = items.map((f) => f.value);
    return current && !values.includes(current) ? [...values, current] : values;
  };

  return (
    <div className="animate-fadein fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        className="animate-rise panel w-full max-w-2xl bg-moss shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-sm tracking-widest text-amber uppercase">
            {initial ? 'Редактирование записи' : 'Новый дрон'}
          </h3>
          <button className="btn btn-ghost !px-2 !py-1.5" onClick={onClose} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
          <div>
            <label className="lbl">Наименование</label>
            <select className="field" value={form.name} onChange={(e) => set('name', e.target.value)}>
              {nameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label className="lbl">День / Ночь</label>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-line bg-panel2 p-1">
              {DAY_NIGHTS.map((dn) => (
                <button
                  key={dn}
                  type="button"
                  onClick={() => set('dayNight', dn)}
                  className={`cursor-pointer rounded px-2 py-1.5 text-sm font-semibold transition ${
                    form.dayNight === dn ? 'bg-amber text-[#1d1503]' : 'text-dim hover:text-khaki'
                  }`}
                >
                  {dn}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="lbl">Частота управления</label>
            <select className="field" value={form.controlFreq} onChange={(e) => set('controlFreq', e.target.value)}>
              {freqOptions(dicts.controlFreqs, form.controlFreq).map((v) => (
                <option key={v} value={v}>
                  {v}{!isControlStandard(v, dicts) ? '  ·  НС' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="lbl">Частота видео, ГГц</label>
            <select className="field" value={form.videoFreq} onChange={(e) => set('videoFreq', e.target.value)}>
              {freqOptions(dicts.videoFreqs, form.videoFreq).map((v) => (
                <option key={v} value={v}>
                  {v}{!isVideoStandard(v, dicts) ? '  ·  НС' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="lbl">Состояние</label>
            <select className="field" value={form.condition} onChange={(e) => set('condition', e.target.value as Condition)}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="lbl">Наличие</label>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-line bg-panel2 p-1">
              {PRESENCES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('presence', p as Presence)}
                  className={`cursor-pointer rounded px-2 py-1.5 text-sm font-semibold transition ${
                    form.presence === p
                      ? p === 'В наличии' ? 'bg-ready/80 text-[#12210a]' : 'bg-orang/90 text-[#2a1302]'
                      : 'text-dim hover:text-khaki'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="lbl">Кто получил</label>
            <input className="field" value={form.receivedBy} placeholder="Склад БТиВО…"
              onChange={(e) => set('receivedBy', e.target.value)} />
          </div>

          <div>
            <label className="lbl">У кого находится (позывной)</label>
            <select className="field" value={form.holder} onChange={(e) => set('holder', e.target.value)}>
              <option value="">— не выдан —</option>
              {[...new Set([...dicts.operators, ...(form.holder ? [form.holder] : [])])].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="lbl">Примечание</label>
            <textarea className="field min-h-[68px] resize-y" value={form.note}
              placeholder="Например: в ремонте, замена мотора…"
              onChange={(e) => set('note', e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button
            className="btn btn-amber"
            onClick={() => { if (form.name.trim() !== '') onSave({ ...form, name: form.name.trim() }); }}
          >
            <Plus size={15} /> {initial ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Основная таблица ---------- */

export default function DetailTable({ records, dicts, onSave, onDelete }: Props) {
  const [search, setSearch] = useState('');
  const [fName, setFName] = useState('');
  const [fDayNight, setFDayNight] = useState('');
  const [fCondition, setFCondition] = useState('');
  const [fPresence, setFPresence] = useState('');
  const [modal, setModal] = useState<DroneRecord | null | 'new'>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  /* Сброс подтверждения удаления через 3 секунды */
  useEffect(() => {
    if (!confirmId) return;
    const t = setTimeout(() => setConfirmId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmId]);

  const nameOptions = useMemo(
    () => [...new Set([...dicts.names, ...records.map((r) => r.name)])].filter(Boolean),
    [dicts.names, records],
  );

  /* Фильтрация: наименование + тип + состояние + наличие + полнотекстовый поиск */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (fName && r.name !== fName) return false;
      if (fDayNight && r.dayNight !== fDayNight) return false;
      if (fCondition && r.condition !== fCondition) return false;
      if (fPresence && r.presence !== fPresence) return false;
      if (q) {
        const hay = `${r.name} ${r.dayNight} ${r.controlFreq} ${r.videoFreq} ${r.condition} ${r.presence} ${r.note} ${r.receivedBy} ${r.holder}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, search, fName, fDayNight, fCondition, fPresence]);

  const hasFilters = !!(search || fName || fDayNight || fCondition || fPresence);
  const resetFilters = () => { setSearch(''); setFName(''); setFDayNight(''); setFCondition(''); setFPresence(''); };

  const freqCell = (value: string, standard: boolean) => (
    <span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[13px] ${
      standard ? 'text-dim' : 'bg-nsu/15 font-semibold text-nsu'
    }`}>
      {!standard && <AlertTriangle size={12} className="shrink-0" />}
      {value || '—'}
    </span>
  );

  return (
    <section className="animate-rise">
      {/* Панель инструментов: поиск, фильтры, добавление */}
      <div className="panel mb-4 flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            className="field !pl-9"
            placeholder="Поиск: наименование, позывной, примечание…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
          <select className="field" value={fName} onChange={(e) => setFName(e.target.value)}>
            <option value="">Все наименования</option>
            {nameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select className="field" value={fDayNight} onChange={(e) => setFDayNight(e.target.value as DayNight | '')}>
            <option value="">День и ночь</option>
            {DAY_NIGHTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="field" value={fCondition} onChange={(e) => setFCondition(e.target.value as Condition | '')}>
            <option value="">Любое состояние</option>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="field" value={fPresence} onChange={(e) => setFPresence(e.target.value as Presence | '')}>
            <option value="">Любое наличие</option>
            {PRESENCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {hasFilters && (
            <button className="btn btn-ghost" onClick={resetFilters}><X size={15} /> Сброс</button>
          )}
          <button className="btn btn-amber" onClick={() => setModal('new')}><Plus size={16} /> Добавить дрон</button>
        </div>
      </div>

      {/* Таблица */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-moss text-left text-[11px] tracking-[0.14em] text-dim uppercase">
                <th className="px-3 py-3 font-semibold">№</th>
                <th className="px-3 py-3 font-semibold">Наименование</th>
                <th className="px-3 py-3 font-semibold">Д/Н</th>
                <th className="px-3 py-3 font-semibold">Частота упр.</th>
                <th className="px-3 py-3 font-semibold">Частота видео</th>
                <th className="px-3 py-3 font-semibold">Состояние</th>
                <th className="px-3 py-3 font-semibold">Наличие</th>
                <th className="px-3 py-3 font-semibold">Примечание</th>
                <th className="px-3 py-3 font-semibold">Кто получил</th>
                <th className="px-3 py-3 font-semibold">У кого находится</th>
                <th className="px-3 py-3 text-right font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr
                  key={r.id}
                  className="group border-b border-line/60 border-l-2 transition-colors duration-150 last:border-b-0 hover:bg-panel2/70"
                  style={{ borderLeftColor: rowEdgeByCondition[r.condition], animationDelay: `${Math.min(idx, 20) * 18}ms` }}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-faint">{idx + 1}</td>
                  {/* Колонка C — подсветка по состоянию */}
                  <td className={`px-3 py-2.5 font-semibold whitespace-nowrap ${nameCellByCondition[r.condition]}`}>{r.name}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${r.dayNight === 'Ночь' ? 'bg-bluish/15 text-bluish' : 'bg-amber/12 text-amber'}`}>
                      {r.dayNight}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{freqCell(r.controlFreq, isControlStandard(r.controlFreq, dicts))}</td>
                  <td className="px-3 py-2.5">{freqCell(r.videoFreq, isVideoStandard(r.videoFreq, dicts))}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${badgeByCondition[r.condition]}`}
                      title={r.condition}>
                      {COND_SHORT[r.condition]}
                    </span>
                  </td>
                  {/* Колонка H — оранжевый при «Не в наличии» */}
                  <td className={`px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap ${r.presence === 'Не в наличии' ? 'text-orang' : 'text-ready'}`}>
                    {r.presence}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-[13px] text-dim" title={r.note}>{r.note || '—'}</td>
                  <td className="px-3 py-2.5 text-[13px] whitespace-nowrap text-dim">{r.receivedBy || '—'}</td>
                  <td className="px-3 py-2.5">
                    {r.holder
                      ? <span className="font-mono text-[13px] font-semibold text-bluish">{r.holder}</span>
                      : <span className="text-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1 opacity-45 transition-opacity duration-150 group-hover:opacity-100">
                      <button className="btn btn-ghost !border-line !px-2 !py-1.5" title="Редактировать"
                        onClick={() => setModal(r)}>
                        <Pencil size={14} />
                      </button>
                      {confirmId === r.id ? (
                        <button
                          className="btn btn-danger !px-2 !py-1.5 !text-xs"
                          onClick={() => { onDelete(r.id); setConfirmId(null); }}
                        >
                          Удалить?
                        </button>
                      ) : (
                        <button className="btn btn-ghost !border-line !px-2 !py-1.5 hover:!border-alert/50 hover:!text-alert"
                          title="Удалить" onClick={() => setConfirmId(r.id)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Пустые состояния */}
        {records.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Plane size={40} className="text-faint" />
            <p className="font-display text-sm tracking-widest text-dim uppercase">Записей пока нет</p>
            <p className="max-w-sm text-sm text-faint">Добавьте первый дрон — данные сохраняются локально в браузере.</p>
            <button className="btn btn-amber mt-2" onClick={() => setModal('new')}><Plus size={15} /> Добавить дрон</button>
          </div>
        )}
        {records.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Search size={32} className="text-faint" />
            <p className="text-sm text-dim">По заданным условиям ничего не найдено.</p>
            <button className="btn btn-ghost" onClick={resetFilters}><X size={14} /> Сбросить фильтры</button>
          </div>
        )}
      </div>

      {/* Итоговая строка */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-faint">
        <span>
          Показано <b className="font-mono text-dim">{filtered.length}</b> из{' '}
          <b className="font-mono text-dim">{records.length}</b> записей
        </span>
        <span className="hidden items-center gap-3 sm:flex">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-ready/70" /> исправен
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-nsu/70" /> НС частот
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-alert/70" /> не исправен
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-alertdeep" /> боевое применение
        </span>
      </div>

      {modal !== null && (
        <RecordModal
          initial={modal === 'new' ? null : modal}
          dicts={dicts}
          records={records}
          onClose={() => setModal(null)}
          onSave={(rec) => { onSave(rec); setModal(null); }}
        />
      )}
    </section>
  );
}
