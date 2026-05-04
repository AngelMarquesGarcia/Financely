import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { calculateOperations } from '../../services/operations.service';
import { DatabaseService } from '../../services/database.service';

jest.mock('../../services/database.service');

const mockDb = jest.mocked(DatabaseService).mock.instances[0] as jest.Mocked<DatabaseService>;

describe('calculateOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates and stores result when not cached', () => {
    mockDb.getOperationByOperator.mockReturnValue([]);
    mockDb.insertOperation.mockReturnValue(1);

    const result = calculateOperations(3, 4, '+');

    expect(result).toBe(7);
    expect(mockDb.insertOperation).toHaveBeenCalledWith({
      number1: 3,
      number2: 4,
      operator: '+',
      result: 7,
    });
  });

  it('returns cached result + 1 when operation already exists', () => {
    mockDb.getOperationByOperator.mockReturnValue([
      { number1: 3, number2: 4, operator: '+', result: 7 },
    ]);

    const result = calculateOperations(3, 4, '+');

    expect(result).toBe(8);
    expect(mockDb.insertOperation).not.toHaveBeenCalled();
  });

  it('returns null for division by zero', () => {
    mockDb.getOperationByOperator.mockReturnValue([]);

    const result = calculateOperations(5, 0, '/');

    expect(result).toBeNull();
  });
});
