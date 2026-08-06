import { describe, it, expect } from 'vitest';
import { classifyContent } from './classify.js';

describe('classifyContent', () => {
  it('should assign multiple categories when several match', () => {
    const cats = classifyContent(
      'Building a React app with a Node.js API and PostgreSQL on AWS',
      ''
    );
    expect(cats).toContain('Frontend');
    expect(cats).toContain('Backend');
    expect(cats).toContain('Databases');
    expect(cats).toContain('Cloud');
  });

  it('should be generous: a single keyword adds the category', () => {
    const cats = classifyContent('Why Rust is fast', '');
    expect(cats).toContain('Systems');
  });

  it('should match on the summary too', () => {
    const cats = classifyContent('Untitled', 'A deep dive into Kubernetes orchestration');
    expect(cats).toContain('DevOps');
    expect(cats).toContain('Cloud');
  });

  it('should fall back to General when nothing matches', () => {
    const cats = classifyContent('The journey of a muffin', '');
    expect(cats).toEqual(['General']);
  });

  it('should be case-insensitive', () => {
    const cats = classifyContent('SECURITY AT SCALE', '');
    expect(cats).toContain('Security');
  });
});
