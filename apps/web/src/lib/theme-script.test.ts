import { describe, expect, it } from 'vitest';
import { parseThemePreference, themeScript, themeStorageKey } from './theme-script';

describe('parseThemePreference', () => {
  it('keeps light and dark', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('falls back to system for anything else', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference('Dark')).toBe('system');
    expect(parseThemePreference(1)).toBe('system');
  });
});

describe('themeScript', () => {
  function run(stored: string | null, throws = false) {
    const attributes: Record<string, string> = {};
    const localStorage = {
      getItem: (key: string) => {
        if (throws) throw new Error('blocked');
        return key === themeStorageKey ? stored : null;
      },
    };
    const document = {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attributes[name] = value;
        },
      },
    };
    new Function('localStorage', 'document', themeScript)(localStorage, document);
    return attributes['data-theme'];
  }

  it('sets the saved theme', () => {
    expect(run('dark')).toBe('dark');
    expect(run('light')).toBe('light');
  });

  it('leaves the system theme alone', () => {
    expect(run(null)).toBeUndefined();
    expect(run('purple')).toBeUndefined();
    expect(run('dark', true)).toBeUndefined();
  });
});
