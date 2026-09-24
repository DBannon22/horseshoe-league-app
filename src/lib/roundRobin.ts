/**
 * Circle-method round robin. For an even number of items, returns n-1 rounds
 * of n/2 pairs in which every item meets every other item exactly once.
 */
export function roundRobin<T>(items: readonly T[]): [T, T][][] {
  const n = items.length;
  if (n % 2 !== 0) throw new Error('roundRobin needs an even number of items');
  const arr = items.slice();
  const rounds: [T, T][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [T, T][] = [];
    for (let i = 0; i < n / 2; i++) pairs.push([arr[i], arr[n - 1 - i]]);
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}
