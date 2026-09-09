/* ============================================================
 * Вкладка «Справочники» — управление списками исходного файла:
 * наименования, позывные операторов, частоты управления/видео
 * (с признаком «стандартная» — влияет на жёлтую подсветку E/F).
 * ============================================================ */

import { useState } from 'react';
import { BookOpen, Check, Plus, X } from 'lucide-react';
import type { Dicts, DroneRecord, FreqItem } from '../logic';

interface Props {
  dicts: Dicts;
  records: DroneRecord[];
  onChange: (d: Dicts) => void;
}

/* Подсчёт использований значения в записях */
const useCount = (records: DroneRecord[], fn: (r: DroneRecord) => string) => {
  const map = new Map<string, number>();
  for (const r of records) {
    const v = fn(r);
    if (v) map.set(v, (map.get(v) ?? 0) + 1);
  }
  return map;
};

function AddLine({ onAdd, placeholder }: { onAdd: (v: string) => void; placeholder: string }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue('');
  };
  return (
    <div className="mt-3 flex gap-2">
      <input
        className="field"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      <button className="btn shrink-0 !px-3" onClick={submit} aria-label="Добавить">
        <Plus size={15} />
      </button>
    </div>
  );
}

function DictCard({
  title, hint, items, usage, onAdd, onRemove,
}: {
  title: string;
  hint: string;
  items: string[];
  usage: Map<string, number>;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="panel flex flex-col p-4">
      <h3 className="font-display text-[13px] tracking-widest text-amber uppercase">{title}</h3>
      <p className="mt-1 text-xs text-faint">{hint}</p>
      <ul className="mt-3 flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
        {items.length === 0 && <li className="py-4 text-center text-xs text-faint">Список пуст</li>}
        {items.map((v) => (
          <li key={v} className="group flex items-center gap-2 rounded-md border border-line/70 bg-panel2/60 px-2.5 py-1.5 transition-colors hover:border-line2">
            <span className="flex-1 text-sm font-medium">{v}</span>
            <span className="font-mono text-[10px] text-faint" title="Использований в записях">
              ×{usage.get(v) ?? 0}
            </span>
            {confirm === v ? (
              <button className="btn btn-danger !px-2 !py-1 !text-[11px]" onClick={() => { onRemove(v); setConfirm(null); }}>
                Точно?
              </button>
            ) : (
              <button
                className="btn btn-ghost !px-1.5 !py-1 opacity-40 group-hover:opacity-100 hover:!text-alert"
                onClick={() => setConfirm(v)}
                aria-label={`Удалить ${v}`}
              >
                <X size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <AddLine onAdd={onAdd} placeholder="Новое значение…" />
    </div>
  );
}

function FreqCard({
  title, hint, items, usage, onAdd, onRemove, onToggle,
}: {
  title: string;
  hint: string;
  items: FreqItem[];
  usage: Map<string, number>;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  onToggle: (v: string) => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="panel flex flex-col p-4">
      <h3 className="font-display text-[13px] tracking-widest text-amber uppercase">{title}</h3>
      <p className="mt-1 text-xs text-faint">{hint}</p>
      <ul className="mt-3 flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
        {items.length === 0 && <li className="py-4 text-center text-xs text-faint">Список пуст</li>}
        {items.map((f) => (
          <li key={f.value} className="group flex items-center gap-2 rounded-md border border-line/70 bg-panel2/60 px-2.5 py-1.5 transition-colors hover:border-line2">
            <span className="font-mono text-sm font-semibold">{f.value}</span>
            <span className="font-mono text-[10px] text-faint">×{usage.get(f.value) ?? 0}</span>
            <button
              onClick={() => onToggle(f.value)}
              title={f.standard ? 'Сделать нестандартной' : 'Сделать стандартной'}
              className={`ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                f.standard
                  ? 'border-ready/40 bg-ready/10 text-ready'
                  : 'border-nsu/40 bg-nsu/10 text-nsu'
              }`}
            >
              {f.standard && <Check size={11} />}
              {f.standard ? 'стандарт' : 'НС'}
            </button>
            {confirm === f.value ? (
              <button className="btn btn-danger !px-2 !py-1 !text-[11px]" onClick={() => { onRemove(f.value); setConfirm(null); }}>
                Точно?
              </button>
            ) : (
              <button
                className="btn btn-ghost !px-1.5 !py-1 opacity-40 group-hover:opacity-100 hover:!text-alert"
                onClick={() => setConfirm(f.value)}
                aria-label={`Удалить ${f.value}`}
              >
                <X size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <AddLine onAdd={onAdd} placeholder="Например: ELRS-868…" />
    </div>
  );
}

export default function Dictionaries({ dicts, records, onChange }: Props) {
  const nameUse = useCount(records, (r) => r.name);
  const opUse = useCount(records, (r) => r.holder);
  const cfUse = useCount(records, (r) => r.controlFreq);
  const vfUse = useCount(records, (r) => r.videoFreq);

  const addUnique = (list: string[], v: string) => (list.includes(v) ? list : [...list, v]);

  return (
    <section className="animate-rise">
      <div className="panel mb-4 flex items-center gap-3 p-3.5">
        <BookOpen size={18} className="shrink-0 text-amber" />
        <p className="text-sm text-dim">
          Справочники соответствуют правым колонкам листа «Подробно». Частоты с меткой{' '}
          <b className="text-nsu">НС</b> подсвечиваются жёлтым в колонках E/F детальной таблицы.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DictCard
          title="Наименования"
          hint="Типы дронов (колонка C)"
          items={dicts.names}
          usage={nameUse}
          onAdd={(v) => onChange({ ...dicts, names: addUnique(dicts.names, v) })}
          onRemove={(v) => onChange({ ...dicts, names: dicts.names.filter((x) => x !== v) })}
        />
        <DictCard
          title="Позывные операторов"
          hint="У кого находится (колонка K)"
          items={dicts.operators}
          usage={opUse}
          onAdd={(v) => onChange({ ...dicts, operators: addUnique(dicts.operators, v) })}
          onRemove={(v) => onChange({ ...dicts, operators: dicts.operators.filter((x) => x !== v) })}
        />
        <FreqCard
          title="Частоты управления"
          hint="Колонка E: TBS-915, ELRS-915…"
          items={dicts.controlFreqs}
          usage={cfUse}
          onAdd={(v) => onChange({ ...dicts, controlFreqs: dicts.controlFreqs.some((f) => f.value === v) ? dicts.controlFreqs : [...dicts.controlFreqs, { value: v, standard: false }] })}
          onRemove={(v) => onChange({ ...dicts, controlFreqs: dicts.controlFreqs.filter((f) => f.value !== v) })}
          onToggle={(v) => onChange({ ...dicts, controlFreqs: dicts.controlFreqs.map((f) => (f.value === v ? { ...f, standard: !f.standard } : f)) })}
        />
        <FreqCard
          title="Частоты видео"
          hint="Колонка F: 1.2 / 1.5 / 5.8 ГГц"
          items={dicts.videoFreqs}
          usage={vfUse}
          onAdd={(v) => onChange({ ...dicts, videoFreqs: dicts.videoFreqs.some((f) => f.value === v) ? dicts.videoFreqs : [...dicts.videoFreqs, { value: v, standard: false }] })}
          onRemove={(v) => onChange({ ...dicts, videoFreqs: dicts.videoFreqs.filter((f) => f.value !== v) })}
          onToggle={(v) => onChange({ ...dicts, videoFreqs: dicts.videoFreqs.map((f) => (f.value === v ? { ...f, standard: !f.standard } : f)) })}
        />
      </div>
    </section>
  );
}
