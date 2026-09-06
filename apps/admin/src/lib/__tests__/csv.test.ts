import { describe, it, expect } from 'vitest';
import { rowsToCsv } from '../csv';

describe('rowsToCsv', () => {
  it('joins headers and rows with commas and newlines', () => {
    const csv = rowsToCsv(['Name', 'Status'], [['Ahmed Ali', 'picked_up']]);
    expect(csv).toBe('Name,Status\nAhmed Ali,picked_up');
  });

  it('quotes values containing commas', () => {
    const csv = rowsToCsv(['Name'], [['Ali, Ahmed']]);
    expect(csv).toBe('Name\n"Ali, Ahmed"');
  });

  it('quotes and escapes embedded double quotes', () => {
    const csv = rowsToCsv(['Note'], [['He said "hello"']]);
    expect(csv).toBe('Note\n"He said ""hello"""');
  });

  it('quotes values containing newlines', () => {
    const csv = rowsToCsv(['Note'], [['line one\nline two']]);
    expect(csv).toBe('Note\n"line one\nline two"');
  });

  it('renders null as an empty field, not the string "null"', () => {
    const csv = rowsToCsv(['Stop'], [[null]]);
    expect(csv).toBe('Stop\n');
  });

  it('handles multiple rows in order', () => {
    const csv = rowsToCsv(
      ['Bus', 'Trips'],
      [
        ['BUS-01', 3],
        ['BUS-02', 5],
      ]
    );
    expect(csv).toBe('Bus,Trips\nBUS-01,3\nBUS-02,5');
  });
});
