import { describe, expect, it } from 'vitest';
import { ApiRequestError } from './api';
import { backupErrorLines, backupFileName, backupPathLabel, importSummary } from './backup';

describe('backupFileName', () => {
  it('uses the UTC date', () => {
    expect(backupFileName(new Date('2026-11-02T23:30:00-03:00'))).toBe(
      'pageclock-backup-2026-11-03.json',
    );
  });
});

describe('backupPathLabel', () => {
  it('names books and sessions from 1', () => {
    expect(backupPathLabel('books.0.title')).toBe('Book 1, title');
    expect(backupPathLabel('sessions.3.endPage')).toBe('Session 4, end page');
    expect(backupPathLabel('books.2')).toBe('Book 3');
  });

  it('keeps top-level and unknown paths', () => {
    expect(backupPathLabel('format')).toBe('format');
    expect(backupPathLabel('_')).toBe('');
    expect(backupPathLabel('sessions.0.weird')).toBe('Session 1, weird');
  });
});

describe('backupErrorLines', () => {
  it('lists field problems with their location, up to a limit', () => {
    const error = new ApiRequestError(400, 'validation_error', 'The backup has invalid data', {
      'books.0.title': ['Enter a title'],
      'sessions.1.endPage': ['End page can’t be above the book’s 400 pages.'],
      _: ['Something at the top'],
    });
    expect(backupErrorLines(error)).toEqual([
      'Book 1, title: Enter a title',
      'Session 2, end page: End page can’t be above the book’s 400 pages.',
      'Something at the top',
    ]);
    expect(backupErrorLines(error, 1)).toEqual(['Book 1, title: Enter a title', '…and 2 more']);
  });

  it('falls back to the error message', () => {
    expect(backupErrorLines(new ApiRequestError(413, 'payload_too_large', 'Too large'))).toEqual([
      'Too large',
    ]);
    expect(backupErrorLines(new Error('Boom'))).toEqual(['Boom']);
    expect(backupErrorLines('nope')).toEqual(['Something went wrong. Try again.']);
  });
});

describe('importSummary', () => {
  it('says when nothing was new', () => {
    expect(
      importSummary({ books: { added: 0, matched: 3 }, sessions: { added: 0, skipped: 9 } }),
    ).toBe('Nothing new: everything in this file is already in your library.');
  });

  it('counts what was added and skipped', () => {
    expect(
      importSummary({ books: { added: 1, matched: 0 }, sessions: { added: 14, skipped: 0 } }),
    ).toBe('Added 1 book and 14 sessions.');
    expect(
      importSummary({ books: { added: 2, matched: 1 }, sessions: { added: 1, skipped: 2 } }),
    ).toBe(
      'Added 2 books and 1 session. 1 book was already in your library. 2 sessions were already logged.',
    );
  });
});
