// Desktop data table: sortable columns, one selected row, arrow-key navigation, many rows visible at once.
// Pointer-sized rows (about 30px); the phone layouts keep their 44px rows and never render this. No game logic:
// callers pass already-derived rows and per-column `get` (sort key) / `cell` (render). Top-level component only.
import { useState } from 'react';

const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }));

export function DataTable({ id, label, title, count, columns, rows, rowId, selected, onSelect, initialSort = null }) {
  const [sort, setSort] = useState(initialSort); // { col, dir: 1 | -1 } | null = source order
  const col = sort && columns.find((c) => c.id === sort.col);
  const shown = col ? [...rows].sort((a, b) => sort.dir * cmp(col.get(a), col.get(b))) : rows;
  const click = (c) => setSort((s) => (!s || s.col !== c.id ? { col: c.id, dir: c.num ? -1 : 1 } : s.dir === (c.num ? -1 : 1) ? { col: c.id, dir: -sort.dir } : null));
  const key = (e) => {
    if (!onSelect || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const i = shown.findIndex((r) => rowId(r) === selected); const n = shown[Math.max(0, Math.min(shown.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (n) { e.preventDefault(); onSelect(rowId(n)); e.currentTarget.querySelector(`[data-row="${CSS.escape(String(rowId(n)))}"]`)?.scrollIntoView?.({ block: 'nearest' }); }
  };
  return (
    <div className="wl-tbl-wrap" data-table={id}>
      {title && <div className="wl-tbl-title wl-label">{title}<span>{count ?? rows.length}</span></div>}
      <table className="wl-tbl" aria-label={label} onKeyDown={key}>
        <thead><tr>{columns.map((c) => (
          <th key={c.id} scope="col" data-num={c.num || undefined} style={c.w ? { width: c.w } : undefined} aria-sort={sort?.col === c.id ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
            <button type="button" data-sort={c.id} onClick={() => click(c)} title={`Sort by ${c.label}`}>{c.label}<span aria-hidden="true">{sort?.col === c.id ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</span></button>
          </th>))}</tr></thead>
        <tbody>{shown.map((r) => {
          const rid = rowId(r);
          return (
            <tr key={rid} data-row={rid} tabIndex={selected === rid ? 0 : -1} aria-selected={selected === rid} onClick={() => onSelect?.(rid)} onFocus={() => onSelect && selected !== rid && onSelect(rid)}>
              {columns.map((c) => <td key={c.id} data-num={c.num || undefined} data-tone={c.tone?.(r)}>{c.cell ? c.cell(r) : c.get(r)}</td>)}
            </tr>);
        })}</tbody>
      </table>
    </div>
  );
}
