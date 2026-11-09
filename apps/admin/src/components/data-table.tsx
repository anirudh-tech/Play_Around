import type { ReactNode } from 'react';

export function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-[11px] uppercase text-text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-text-muted" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((cells, index) => (
              <tr key={index} className="border-t border-border">
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function asList<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}
