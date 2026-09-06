/* ============================================================
 * Учёт FPV-дронов — модель данных и вся расчётная логика.
 * Подсчёты воспроизводят VBA-макрос Excel-файла:
 *   Получено      = число записей по наименованию
 *   В наличии     = записи с наличием «В наличии»
 *   Готовы        = состояние «Исправен»
 *   НСУ           = состояние «Исправен/Не стандарт частот»
 *   Не исправен   = «Не исправен» (отдельно в наличии / не в наличии)
 *   Боевая работа = «Боевое применение» + «Не в наличии»
 *   Всего(не готовы) = НСУ + НеИсп(в наличии) + НеИсп(не в наличии) + Боевая
 *   «У кого находятся» = группировка «Исправен» по столбцу K (позывной - N ед.)
 * ============================================================ */

export type DayNight = 'День' | 'Ночь';
export type Condition =
  | 'Исправен'
  | 'Исправен/Не стандарт частот'
  | 'Не исправен'
  | 'Боевое применение';
export type Presence = 'В наличии' | 'Не в наличии';

/* Запись детального учёта (строка листа «Подробно», столбцы C–K) */
export interface DroneRecord {
  id: string;
  name: string;         // C — наименование (ПВХ-1, Велес, … «Без наименования»)
  dayNight: DayNight;   // D — день/ночь
  controlFreq: string;  // E — частота управления (TBS-915, ELRS-915, …)
  videoFreq: string;    // F — частота видео (1.2, 1.5, 5.8)
  condition: Condition; // G — состояние
  presence: Presence;   // H — наличие
  note: string;         // I — примечание
  receivedBy: string;   // J — кто получил
  holder: string;       // K — у кого находится (позывной)
}

/* Частота справочника: значение + признак «стандартная»
   (нестандартные подсвечиваются жёлтым в колонках E/F) */
export interface FreqItem { value: string; standard: boolean; }

/* Справочники листа «Подробно» */
export interface Dicts {
  names: string[];          // наименования дронов
  operators: string[];      // позывные операторов
  controlFreqs: FreqItem[]; // частоты управления
  videoFreqs: FreqItem[];   // частоты видео
}

/* Константы для форм */
export const CONDITIONS: Condition[] = [
  'Исправен',
  'Исправен/Не стандарт частот',
  'Не исправен',
  'Боевое применение',
];
export const PRESENCES: Presence[] = ['В наличии', 'Не в наличии'];
export const DAY_NIGHTS: DayNight[] = ['День', 'Ночь'];

/* ---------- Строка отчёта (и строка итогов — те же поля) ---------- */
export interface ReportRow {
  name: string;            // наименование (для итогов — подпись «Итого дневных»…)
  received: number;        // Получено
  inStock: number;         // В наличии
  ready: number;           // Готовы к применению
  holders: string;         // «позывной - N ед.» по строкам, либо «-»
  notReadyTotal: number;   // Не готовы — всего (G = SUM(H:K), как в RecalculateColumnG)
  nsu: number;             // не стандартная частота (НСУ)
  brokenInStock: number;   // не исправен (в наличии)
  brokenOutOfStock: number;// не исправен (не в наличии)
  combat: number;          // боевая работа
}

/* Готовый отчёт — аналог листа Excel с именем dd.MM.yyyy */
export interface Report {
  dateKey: string;               // dd.MM.yyyy
  createdAt: number;             // метка формирования
  dayRows: ReportRow[];          // секция «Дневные FPV дроны»
  nightRows: ReportRow[];        // секция «Ночные FPV дроны» (может быть пустой)
  dayTotals: ReportRow;          // «Итого дневных»
  nightTotals: ReportRow | null; // «Итого ночных» (только при наличии ночных)
  grandTotals: ReportRow;        // «ВСЕГО» + объединённая разбивка по операторам
}

/* ===================== УТИЛИТЫ ===================== */

export const uid = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);

/* dd.MM.yyyy — имя листа отчёта */
export function formatDateKey(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/* dd.MM.yyyy HH:mm — для отображения метки формирования */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDateKey(d)} ${hh}:${mi}`;
}

/* ===================== РАСЧЁТ ОТЧЁТА ===================== */

/* Уникальные наименования секции в порядке первого появления в записях */
function uniqueNames(records: DroneRecord[], dayNight: DayNight): string[] {
  const seen: string[] = [];
  for (const r of records) {
    if (r.dayNight === dayNight && r.name.trim() !== '' && !seen.includes(r.name)) {
      seen.push(r.name);
    }
  }
  return seen;
}

/* Группировка исправных дронов по позывным: «Грач-17 - 3 ед.\nСтерх-26 - 2 ед.» */
export function groupHolders(records: DroneRecord[]): string {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.condition === 'Исправен' && r.holder.trim() !== '') {
      counts.set(r.holder, (counts.get(r.holder) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return '-';
  return [...counts.entries()].map(([k, v]) => `${k} - ${v} ед.`).join('\n');
}

/* Показатели по одному наименованию внутри секции (день/ночь) */
function buildRow(records: DroneRecord[], dayNight: DayNight, name: string): ReportRow {
  const rs = records.filter((r) => r.name === name && r.dayNight === dayNight);
  const nsu = rs.filter((r) => r.condition === 'Исправен/Не стандарт частот').length;
  const brokenInStock = rs.filter((r) => r.condition === 'Не исправен' && r.presence === 'В наличии').length;
  const brokenOutOfStock = rs.filter((r) => r.condition === 'Не исправен' && r.presence === 'Не в наличии').length;
  const combat = rs.filter((r) => r.condition === 'Боевое применение' && r.presence === 'Не в наличии').length;
  return {
    name,
    received: rs.length,
    inStock: rs.filter((r) => r.presence === 'В наличии').length,
    ready: rs.filter((r) => r.condition === 'Исправен').length,
    holders: groupHolders(rs),
    nsu,
    brokenInStock,
    brokenOutOfStock,
    combat,
    notReadyTotal: nsu + brokenInStock + brokenOutOfStock + combat, // G = SUM(H:K)
  };
}

/* Итоговая строка: суммы столбцов + объединённая разбивка по операторам */
function buildTotals(label: string, rows: ReportRow[], sectionRecords: DroneRecord[]): ReportRow {
  const sum = (f: (r: ReportRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    name: label,
    received: sum((r) => r.received),
    inStock: sum((r) => r.inStock),
    ready: sum((r) => r.ready),
    holders: groupHolders(sectionRecords),
    nsu: sum((r) => r.nsu),
    brokenInStock: sum((r) => r.brokenInStock),
    brokenOutOfStock: sum((r) => r.brokenOutOfStock),
    combat: sum((r) => r.combat),
    notReadyTotal: sum((r) => r.notReadyTotal),
  };
}

/* Полный отчёт по всем записям (аналог макроса «тест») */
export function buildReport(records: DroneRecord[]): Report {
  const dayRows = uniqueNames(records, 'День').map((n) => buildRow(records, 'День', n));
  const nightRows = uniqueNames(records, 'Ночь').map((n) => buildRow(records, 'Ночь', n));
  const dayRecs = records.filter((r) => r.dayNight === 'День');
  const nightRecs = records.filter((r) => r.dayNight === 'Ночь');

  const dayTotals = buildTotals('Итого дневных', dayRows, dayRecs);
  const nightTotals = nightRows.length > 0 ? buildTotals('Итого ночных', nightRows, nightRecs) : null;
  const grandTotals = buildTotals('ВСЕГО', [...dayRows, ...nightRows], [...dayRecs, ...nightRecs]);

  return {
    dateKey: formatDateKey(new Date()),
    createdAt: Date.now(),
    dayRows,
    nightRows,
    dayTotals,
    nightTotals,
    grandTotals,
  };
}

/* ===================== СВОДКА ДЛЯ ПАНЕЛИ ===================== */

export interface FleetStats {
  total: number; ready: number; nsu: number; broken: number; combat: number; inStock: number;
}

export function statsOf(records: DroneRecord[]): FleetStats {
  return {
    total: records.length,
    ready: records.filter((r) => r.condition === 'Исправен').length,
    nsu: records.filter((r) => r.condition === 'Исправен/Не стандарт частот').length,
    broken: records.filter((r) => r.condition === 'Не исправен').length,
    combat: records.filter((r) => r.condition === 'Боевое применение').length,
    inStock: records.filter((r) => r.presence === 'В наличии').length,
  };
}

/* Стандартность частоты (для жёлтой подсветки колонок E/F) */
export const isControlStandard = (v: string, d: Dicts) =>
  d.controlFreqs.some((f) => f.value === v && f.standard);
export const isVideoStandard = (v: string, d: Dicts) =>
  d.videoFreqs.some((f) => f.value === v && f.standard);

/* ===================== ЭКСПОРТ / ИМПОРТ ===================== */

/* Скачивание файла через blob-ссылку */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

/* Отчёт → CSV (разделитель «;» для русского Excel, BOM для кодировки) */
export function reportToCSV(rep: Report): string {
  const esc = (v: string | number): string => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const nums = (r: ReportRow) =>
    [r.received, r.inStock, r.ready, r.holders, r.notReadyTotal, r.nsu, r.brokenInStock, r.brokenOutOfStock, r.combat]
      .map(esc)
      .join(';');
  const lines: string[] = [];
  lines.push(esc('ДАННЫЕ по наличию FPV дронов в 7 мотострелковом батальоне (на автомобилях)') + ';'.repeat(10));
  lines.push(`${esc('Отчёт от')} ${rep.dateKey};${esc('сформирован')} ${formatDateTime(rep.createdAt)}${';'.repeat(9)}`);
  lines.push(['№ п/п', 'Наименование', 'Получено', 'В наличии', 'Готовы к применению', 'У кого находятся', 'Не готовы к применению', '', '', '', ''].map(esc).join(';'));
  lines.push(['', '', '', '', '', '', 'Всего', 'Не стандартная частота (НСУ)', 'Не исправен (в наличии)', 'Не исправен (не в наличии)', 'Боевая работа'].map(esc).join(';'));

  const section = (title: string, rows: ReportRow[]) => {
    lines.push(esc(title) + ';'.repeat(10));
    rows.forEach((r, i) => lines.push([esc(`${i + 1}.`), esc(r.name), nums(r)].join(';')));
  };

  section('Дневные FPV дроны', rep.dayRows);
  if (rep.nightRows.length > 0) section('Ночные FPV дроны', rep.nightRows);

  const totalLine = (r: ReportRow) => [esc(r.name), '', nums(r)].join(';');
  lines.push(esc('ИТОГО') + ';'.repeat(10));
  lines.push(totalLine(rep.dayTotals));
  if (rep.nightTotals) lines.push(totalLine(rep.nightTotals));
  lines.push(totalLine(rep.grandTotals));

  return '\uFEFF' + lines.join('\r\n');
}

/* Полный экспорт данных в JSON (записи + справочники + архив отчётов) */
export function exportAllJSON(records: DroneRecord[], dicts: Dicts, reports: Report[]): string {
  return JSON.stringify(
    { app: 'fpv-drones-7msb', version: 1, exportedAt: new Date().toISOString(), records, dicts, reports },
    null,
    2,
  );
}

/* Разбор и проверка импортируемого JSON. Бросает Error с русским текстом. */
export function parseImportJSON(text: string): { records: DroneRecord[]; dicts: Dicts; reports: Report[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Файл повреждён: это не корректный JSON');
  }
  const d = data as Partial<{ records: DroneRecord[]; dicts: Dicts; reports: Report[] }>;
  if (!Array.isArray(d.records)) throw new Error('В файле не найден массив «records»');

  const condOk = (c: unknown): c is Condition => (CONDITIONS as string[]).includes(String(c));
  const presOk = (p: unknown): p is Presence => (PRESENCES as string[]).includes(String(p));
  const dnOk = (x: unknown): x is DayNight => x === 'День' || x === 'Ночь';

  const records: DroneRecord[] = d.records.map((r, i) => ({
    id: typeof r?.id === 'string' ? r.id : uid(),
    name: String(r?.name ?? 'Без наименования'),
    dayNight: dnOk(r?.dayNight) ? r.dayNight : 'День',
    controlFreq: String(r?.controlFreq ?? ''),
    videoFreq: String(r?.videoFreq ?? ''),
    condition: condOk(r?.condition) ? r.condition : 'Исправен',
    presence: presOk(r?.presence) ? r.presence : 'В наличии',
    note: String(r?.note ?? ''),
    receivedBy: String(r?.receivedBy ?? ''),
    holder: String(r?.holder ?? ''),
  }));

  const dicts: Dicts = {
    names: Array.isArray(d.dicts?.names) ? d.dicts!.names.map(String) : [...new Set(records.map((r) => r.name))],
    operators: Array.isArray(d.dicts?.operators) ? d.dicts!.operators.map(String) : [],
    controlFreqs: Array.isArray(d.dicts?.controlFreqs)
      ? d.dicts!.controlFreqs.map((f) => ({ value: String(f.value), standard: f.standard !== false }))
      : [],
    videoFreqs: Array.isArray(d.dicts?.videoFreqs)
      ? d.dicts!.videoFreqs.map((f) => ({ value: String(f.value), standard: f.standard !== false }))
      : [],
  };

  const reports: Report[] = Array.isArray(d.reports)
    ? d.reports.filter((r) => r && typeof r.dateKey === 'string' && Array.isArray(r.dayRows))
    : [];

  if (records.length === 0 && reports.length === 0) {
    throw new Error('Файл не содержит ни одной записи');
  }
  return { records, dicts, reports };
}

/* ===================== LOCALSTORAGE ===================== */

const KEY_RECORDS = 'fpv7_records';
const KEY_DICTS = 'fpv7_dicts';
const KEY_REPORTS = 'fpv7_reports';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const loadRecords = (): DroneRecord[] => load(KEY_RECORDS, seedRecords());
export const loadDicts = (): Dicts => load(KEY_DICTS, seedDicts());
export const loadReports = (): Report[] => load<Report[]>(KEY_REPORTS, []);

export const persist = (records: DroneRecord[], dicts: Dicts, reports: Report[]): void => {
  try {
    localStorage.setItem(KEY_RECORDS, JSON.stringify(records));
    localStorage.setItem(KEY_DICTS, JSON.stringify(dicts));
    localStorage.setItem(KEY_REPORTS, JSON.stringify(reports));
  } catch {
    /* переполнение хранилища — молча игнорируем */
  }
};

/* ===================== ДЕМО-ДАННЫЕ =====================
   Воспроизводят пример из описания:
   ПВХ-1: Получено 18, В наличии 15, Готовы 7 (Грач-17 - 3, Стерх-26 - 2, Опи-25 - 2),
   Не готовы 11 = НСУ 6 + Не исправен (в наличии) 2 + Не исправен (не в наличии) 1 + Боевая работа 2 */

export function seedDicts(): Dicts {
  return {
    names: ['ПВХ-1', 'ПВХ-2', 'Велес', 'Бекас', 'БТ-40', 'Гроза', 'Без наименования'],
    operators: ['Грач-17', 'Стерх-26', 'Опи-25', 'Сокол-12', 'Беркут-8'],
    controlFreqs: [
      { value: 'TBS-915', standard: true },
      { value: 'ELRS-915', standard: true },
      { value: 'ELRS-500', standard: false },
      { value: 'ELRS-2.4', standard: false },
      { value: 'ELRS-750', standard: false },
    ],
    videoFreqs: [
      { value: '5.8', standard: true },
      { value: '1.2', standard: false },
      { value: '1.5', standard: false },
    ],
  };
}

export function seedRecords(): DroneRecord[] {
  let n = 0;
  const mk = (
    name: string, dayNight: DayNight, controlFreq: string, videoFreq: string,
    condition: Condition, presence: Presence, note: string, receivedBy: string, holder: string,
  ): DroneRecord => ({
    id: 'seed-' + String(++n).padStart(3, '0'),
    name, dayNight, controlFreq, videoFreq, condition, presence, note, receivedBy, holder,
  });

  const recs: DroneRecord[] = [];
  const times = (
    count: number,
    fn: (name: string, dayNight: DayNight, cf: string, vf: string, c: Condition, p: Presence, note: string, rb: string, h: string) => DroneRecord,
    name: string, dayNight: DayNight, cf: string, vf: string, c: Condition, p: Presence, note: string, rb: string, h: string,
  ) => { for (let i = 0; i < count; i++) recs.push(fn(name, dayNight, cf, vf, c, p, note, rb, h)); };

  /* ПВХ-1 — дневной, 18 ед. (эталонный пример) */
  times(3, mk, 'ПВХ-1', 'День', 'ELRS-915', '5.8', 'Исправен', 'В наличии', '', 'Склад БТиВО', 'Грач-17');
  times(2, mk, 'ПВХ-1', 'День', 'TBS-915', '5.8', 'Исправен', 'В наличии', '', 'Склад БТиВО', 'Стерх-26');
  times(2, mk, 'ПВХ-1', 'День', 'ELRS-915', '5.8', 'Исправен', 'В наличии', '', 'Склад БТиВО', 'Опи-25');
  times(4, mk, 'ПВХ-1', 'День', 'ELRS-2.4', '1.2', 'Исправен/Не стандарт частот', 'В наличии', 'Нестандартная частота управления', 'Склад БТиВО', '');
  times(2, mk, 'ПВХ-1', 'День', 'ELRS-500', '1.5', 'Исправен/Не стандарт частот', 'В наличии', 'Требуется перепрошивка RX', 'Склад БТиВО', '');
  times(2, mk, 'ПВХ-1', 'День', 'ELRS-915', '5.8', 'Не исправен', 'В наличии', 'В ремонте: замена мотора', 'Склад БТиВО', '');
  times(1, mk, 'ПВХ-1', 'День', 'ELRS-915', '5.8', 'Не исправен', 'Не в наличии', 'Ожидает комплектующие', 'Склад БТиВО', '');
  times(2, mk, 'ПВХ-1', 'День', 'ELRS-915', '5.8', 'Боевое применение', 'Не в наличии', 'Работа на ЛБС', 'Склад БТиВО', '');

  /* ПВХ-2 — дневной, 8 ед. */
  times(2, mk, 'ПВХ-2', 'День', 'ELRS-915', '5.8', 'Исправен', 'В наличии', '', 'Зампотех', 'Сокол-12');
  times(1, mk, 'ПВХ-2', 'День', 'TBS-915', '5.8', 'Исправен', 'В наличии', '', 'Зампотех', 'Беркут-8');
  times(1, mk, 'ПВХ-2', 'День', 'ELRS-750', '1.5', 'Исправен/Не стандарт частот', 'В наличии', 'НС частот', 'Зампотех', '');
  times(2, mk, 'ПВХ-2', 'День', 'ELRS-915', '5.8', 'Не исправен', 'В наличии', 'Неисправна камера', 'Зампотех', '');
  times(1, mk, 'ПВХ-2', 'День', 'ELRS-915', '5.8', 'Не исправен', 'Не в наличии', 'Разбит, списанию подлежит', 'Зампотех', '');
  times(1, mk, 'ПВХ-2', 'День', 'ELRS-915', '5.8', 'Боевое применение', 'Не в наличии', 'Дежурство на направлении', 'Зампотех', '');

  /* Велес — дневной, 6 ед. */
  times(2, mk, 'Велес', 'День', 'ELRS-915', '5.8', 'Исправен', 'В наличии', '', 'Склад БТиВО', 'Грач-17');
  times(2, mk, 'Велес', 'День', 'ELRS-915', '5.8', 'Исправен', 'В наличии', '', 'Склад БТиВО', 'Сокол-12');
  times(1, mk, 'Велес', 'День', 'ELRS-2.4', '5.8', 'Исправен/Не стандарт частот', 'В наличии', 'НС частот', 'Склад БТиВО', '');
  times(1, mk, 'Велес', 'День', 'ELRS-915', '5.8', 'Не исправен', 'В наличии', 'Ремонт антенны', 'Склад БТиВО', '');

  /* БТ-40 — дневной, 5 ед. */
  times(2, mk, 'БТ-40', 'День', 'TBS-915', '5.8', 'Исправен', 'В наличии', '', 'Зампотех', 'Стерх-26');
  times(1, mk, 'БТ-40', 'День', 'TBS-915', '5.8', 'Не исправен', 'В наличии', 'Замена пропеллеров', 'Зампотех', '');
  times(2, mk, 'БТ-40', 'День', 'TBS-915', '5.8', 'Боевое применение', 'Не в наличии', 'Боевая работа', 'Зампотех', '');

  /* Бекас — ночной, 7 ед. */
  times(3, mk, 'Бекас', 'Ночь', 'ELRS-915', '1.2', 'Исправен', 'В наличии', 'Тепловизор', 'Склад БТиВО', 'Опи-25');
  times(1, mk, 'Бекас', 'Ночь', 'ELRS-915', '1.2', 'Исправен', 'В наличии', 'Тепловизор', 'Склад БТиВО', 'Беркут-8');
  times(1, mk, 'Бекас', 'Ночь', 'ELRS-500', '1.5', 'Исправен/Не стандарт частот', 'В наличии', 'НС частот', 'Склад БТиВО', '');
  times(1, mk, 'Бекас', 'Ночь', 'ELRS-915', '1.2', 'Не исправен', 'Не в наличии', 'Потеря связи, поиск', 'Склад БТиВО', '');
  times(1, mk, 'Бекас', 'Ночь', 'ELRS-915', '1.2', 'Боевое применение', 'Не в наличии', 'Ночная работа', 'Склад БТиВО', '');

  /* Гроза — ночной, 4 ед. */
  times(2, mk, 'Гроза', 'Ночь', 'ELRS-915', '1.2', 'Исправен', 'В наличии', '', 'Зампотех', 'Грач-17');
  times(1, mk, 'Гроза', 'Ночь', 'ELRS-750', '1.5', 'Исправен/Не стандарт частот', 'В наличии', 'НС частот', 'Зампотех', '');
  times(1, mk, 'Гроза', 'Ночь', 'ELRS-915', '1.2', 'Не исправен', 'В наличии', 'Юстировка подвеса', 'Зампотех', '');

  return recs;
}
