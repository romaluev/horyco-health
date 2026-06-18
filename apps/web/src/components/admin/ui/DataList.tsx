'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';

export interface DataListColumn<T> {
  key: string;
  header: string;
  /** Hide on mobile card view if not primary. */
  primary?: boolean;
  className?: string;
  render: (row: T) => ReactNode;
}

/** Dense table on md+, stacked cards on mobile from the same column config. */
export function DataList<T>({
  columns,
  rows,
  keyFn,
  onRowClick,
  actions,
  empty,
  className,
}: {
  columns: DataListColumn<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  if (!rows.length && empty) return <>{empty}</>;

  const primaryCols = columns.filter((c) => c.primary !== false);
  const secondaryCols = columns.filter((c) => c.primary === false);

  return (
    <div className={cn('w-full', className)}>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
              {actions ? <TableHead className="w-[1%] text-right">{''}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow
                key={keyFn(row)}
                index={rowIndex}
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

      {/* Mobile cards */}
      <ScrollArea className="md:hidden" viewportClassName="max-h-[70vh]">
        <div className="flex flex-col gap-2 pr-2">
        {rows.map((row) => (
          <Card
            key={keyFn(row)}
            className={cn('overflow-hidden', onRowClick && 'cursor-pointer active:bg-muted/50')}
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
      </ScrollArea>
    </div>
  );
}
