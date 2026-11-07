/* Small JavaScript exercises that run in the learner's browser. The tests are plain data (arguments and expected results). */

export interface Exercise {
  id: string;
  concept: string;
  title: string;
  level: 'beginner' | 'easy' | 'medium';
  prompt: string;
  fn: string;
  starter: string;
  tests: Array<{ args: unknown[]; expected: unknown }>;
}

export const EXERCISES: Exercise[] = [
  { id: 'sum-array', concept: 'data-structures', title: 'Sum of an array', level: 'beginner', prompt: 'Return the sum of all numbers in the array. An empty array gives 0.', fn: 'sum', starter: 'function sum(numbers) {\n  \n}', tests: [{ args: [[1, 2, 3]], expected: 6 }, { args: [[]], expected: 0 }, { args: [[-1, 1, 5]], expected: 5 }] },
  { id: 'reverse-string', concept: 'strings', title: 'Reverse a string', level: 'beginner', prompt: 'Return the string written backwards.', fn: 'reverse', starter: 'function reverse(s) {\n  \n}', tests: [{ args: ['abc'], expected: 'cba' }, { args: [''], expected: '' }, { args: ['a b'], expected: 'b a' }] },
  { id: 'is-palindrome', concept: 'strings', title: 'Palindrome', level: 'easy', prompt: 'True if the text reads the same both ways, ignoring case and anything that is not a letter or digit.', fn: 'isPalindrome', starter: 'function isPalindrome(s) {\n  \n}', tests: [{ args: ['Kayak'], expected: true }, { args: ['A man, a plan, a canal: Panama'], expected: true }, { args: ['hello'], expected: false }, { args: [''], expected: true }] },
  { id: 'fizzbuzz', concept: 'programming-basics', title: 'FizzBuzz', level: 'beginner', prompt: 'Return the array for 1..n: "Fizz" for multiples of 3, "Buzz" for 5, "FizzBuzz" for both, else the number.', fn: 'fizzbuzz', starter: 'function fizzbuzz(n) {\n  \n}', tests: [{ args: [5], expected: [1, 2, 'Fizz', 4, 'Buzz'] }, { args: [15], expected: [1, 2, 'Fizz', 4, 'Buzz', 'Fizz', 7, 8, 'Fizz', 'Buzz', 11, 'Fizz', 13, 14, 'FizzBuzz'] }, { args: [0], expected: [] }] },
  { id: 'count-words', concept: 'data-structures', title: 'Count words', level: 'easy', prompt: 'Return an object that maps each lower-cased word to how many times it appears. Words are separated by spaces.', fn: 'countWords', starter: 'function countWords(text) {\n  \n}', tests: [{ args: ['a b a'], expected: { a: 2, b: 1 } }, { args: ['Hello hello'], expected: { hello: 2 } }, { args: [''], expected: {} }] },
  { id: 'two-sum', concept: 'data-structures', title: 'Two sum', level: 'medium', prompt: 'Return the indexes [i, j] (i < j) of two numbers that add up to the target, or null if none.', fn: 'twoSum', starter: 'function twoSum(numbers, target) {\n  \n}', tests: [{ args: [[2, 7, 11, 15], 9], expected: [0, 1] }, { args: [[3, 2, 4], 6], expected: [1, 2] }, { args: [[1, 2], 10], expected: null }] },
  { id: 'flatten', concept: 'recursion', title: 'Flatten', level: 'medium', prompt: 'Flatten a nested array of any depth into a single array (without using Array.prototype.flat).', fn: 'flatten', starter: 'function flatten(list) {\n  \n}', tests: [{ args: [[1, [2, [3, [4]]]]], expected: [1, 2, 3, 4] }, { args: [[]], expected: [] }, { args: [[[], [[]]]], expected: [] }] },
  { id: 'fibonacci', concept: 'recursion', title: 'Fibonacci', level: 'easy', prompt: 'Return the n-th Fibonacci number (fib(0)=0, fib(1)=1). It must stay fast for n = 40.', fn: 'fib', starter: 'function fib(n) {\n  \n}', tests: [{ args: [0], expected: 0 }, { args: [1], expected: 1 }, { args: [10], expected: 55 }, { args: [40], expected: 102334155 }] },
];

export const publicExercise = (e: Exercise) => ({ id: e.id, concept: e.concept, title: e.title, level: e.level, prompt: e.prompt, fn: e.fn, starter: e.starter, tests: e.tests });
