import { describe, it, expect } from 'vitest';
import { classifyContent } from './classify.js';

describe('classifyContent', () => {
  it('matches whole words, not fragments of other words', () => {
    expect(classifyContent('Lecture 4: The Capital Cost of Nuclear Power')).toEqual(['General']);
    expect(classifyContent('How to maintain a garden')).toEqual(['General']);
  });
  it('still finds real topics', () => {
    expect(classifyContent('Building a REST API with Fastify and PostgreSQL')).toEqual(expect.arrayContaining(['Backend', 'Databases']));
    expect(classifyContent('Intro to machine learning with PyTorch')).toContain('AI & ML');
    expect(classifyContent('Learn C++ and Rust for systems programming')).toContain('Systems');
    expect(classifyContent('Docker and Kubernetes in production')).toContain('DevOps');
  });
  it('falls back to General', () => {
    expect(classifyContent('')).toEqual(['General']);
  });
});
