import { describe, it, expect } from 'vitest';
import { cellsToDisplayRows } from '../pdfFormat';

describe('cellsToDisplayRows', () => {
  it('renders null as an em-dash, not the string "null"', () => {
    expect(cellsToDisplayRows([[null]])).toEqual([['—']]);
  });

  it('renders undefined as an em-dash, not the string "undefined"', () => {
    expect(cellsToDisplayRows([[undefined]])).toEqual([['—']]);
  });

  it('stringifies numbers', () => {
    expect(cellsToDisplayRows([[42]])).toEqual([['42']]);
  });

  it('passes strings through unchanged', () => {
    expect(cellsToDisplayRows([['picked_up']])).toEqual([['picked_up']]);
  });

  it('handles multiple rows and columns, preserving order', () => {
    expect(
      cellsToDisplayRows([
        ['BUS-01', 3, null],
        ['BUS-02', null, 'on_time'],
      ])
    ).toEqual([
      ['BUS-01', '3', '—'],
      ['BUS-02', '—', 'on_time'],
    ]);
  });

  it('handles an empty row list', () => {
    expect(cellsToDisplayRows([])).toEqual([]);
  });
});
