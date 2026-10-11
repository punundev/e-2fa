export function formatCode(code: string, grouping: 'grouped' | 'plain' = 'grouped'): string {
  if (grouping === 'plain') {
    return code;
  }
  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
  if (code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }
  return code;
}

export function formatTimeRemaining(seconds: number): string {
  return `${seconds}s`;
}
