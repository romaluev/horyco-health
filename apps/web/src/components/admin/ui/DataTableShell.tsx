'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Hide on mobile card view if not primary. */
  primary?: boolean;
  className?: string;
  render: (row: T) => ReactNode;
}

/** Bordered table with sticky header + native scroll; cards on mobile. */
export function DataTableShell<T>({
  columns,
  rows,
  keyFn,
  onRowClick,
  actions,
  empty,
  className,
  maxHeight = 'max-h-[calc(100dvh-320px)]',
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  if (!rows.length && empty) return <>{empty}</>;

  const primaryCols = columns.filter((c) => c.primary !== false);
  const secondaryCols = columns.filter((c) => c.primary === false);

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('hidden overflow-hidden rounded-lg border md:block')}>
        <div className={cn('overflow-auto', maxHeight)}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow className="hover:bg-muted">
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
                {actions ? <TableHead className="w-[1%] text-right">{''}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={keyFn(row)}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                  {actions ? (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto md:hidden">
        <div className="flex flex-col gap-2 pr-2">
          {rows.map((row) => (
            <Card
              key={keyFn(row)}
              className={cn('overflow-hidden', onRowClick && 'cursor-pointer')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    {primaryCols.map((col) => (
                      <div key={col.key}>{col.render(row)}</div>
                    ))}
                    {secondaryCols.length > 0 ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {secondaryCols.map((col) => (
                          <span key={col.key}>
                            <span className="font-medium">{col.header}: </span>
                            {col.render(row)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {actions ? (
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
