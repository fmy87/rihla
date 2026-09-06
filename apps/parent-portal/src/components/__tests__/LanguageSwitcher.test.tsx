// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import i18n from '../../i18n';
import LanguageSwitcher from '../LanguageSwitcher';

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    // Each test starts from a known language, regardless of what a
    // previous test (or a stale localStorage value) left it on.
    await i18n.changeLanguage('en');
  });

  it('shows English and Arabic as options, with the current language selected', () => {
    render(<LanguageSwitcher />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('en');
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'العربية' })).toBeInTheDocument();
  });

  it('switching to Arabic updates i18n.language and flips the document to RTL', () => {
    render(<LanguageSwitcher />);
    const select = screen.getByRole('combobox');

    fireEvent.change(select, { target: { value: 'ar' } });

    expect(i18n.language).toBe('ar');
    // applyDirection() (src/i18n.ts) is what the rest of the app relies on
    // for RTL layout — this is the one thing actually worth asserting
    // here, since it's the real-world effect of this component existing.
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('switching back to English flips the document back to LTR', () => {
    render(<LanguageSwitcher />);
    const select = screen.getByRole('combobox');

    fireEvent.change(select, { target: { value: 'ar' } });
    expect(document.documentElement.dir).toBe('rtl');

    fireEvent.change(select, { target: { value: 'en' } });
    expect(document.documentElement.dir).toBe('ltr');
  });
});
