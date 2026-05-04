export type Operation = {
  number1: number;
  number2: number;
  operator: string;
  result: number;
};

export type Sentence = {
  sentence: string;
  words: number;
  chars: number;
};

export type Operator = '+' | '-' | '*' | '/';
