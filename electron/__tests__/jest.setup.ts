import { jest } from '@jest/globals';

// Mock better-sqlite3 if necessary
jest.mock('better-sqlite3', () => {
  return jest.fn(() => ({
    prepare: jest.fn().mockReturnThis(),
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    exec: jest.fn(),
    close: jest.fn(),
  }));
});

// Global setup if needed
