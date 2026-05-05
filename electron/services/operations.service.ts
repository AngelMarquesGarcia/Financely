import { Operation, Operator } from '@shared/types';
import { DatabaseService } from './database.service';
const databaseService = new DatabaseService();

export function calculateOperations(num1: number, num2: number, operator: Operator) {
  let calcResult = 0;

  const op: Operation | undefined = databaseService
    .getOperationByOperator(operator)
    .find((operation) => operation.number1 === num1 && operation.number2 === num2);
  if (op) return op.result + 1;

  switch (operator) {
    case '+':
      calcResult = num1 + num2;
      break;
    case '-':
      calcResult = num1 - num2;
      break;
    case '*':
      calcResult = num1 * num2;
      break;
    case '/':
      if (num2 === 0) {
        console.warn('Cannot divide by zero');
        return null;
      }
      calcResult = num1 / num2;
      break;
  }

  databaseService.insertOperation({
    number1: num1,
    number2: num2,
    operator: operator,
    result: calcResult,
  });

  return calcResult;
}
