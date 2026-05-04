import { Operator } from './types';

export interface Api {
  addOne(): Promise<number>;
}

export interface Ops {
  runOperation(n1: number, n2: number, op: Operator): Promise<number>;
}

export interface Sents {
  count(sentence: string): Promise<{ chars: number; words: number }>;
}
