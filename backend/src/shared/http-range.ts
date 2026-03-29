/** RFC 7233-style single byte-range parsing for streaming handlers. */
export function parseByteRange(
  header: string | undefined,
  size: number
): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header?.startsWith('bytes=')) {
    return null;
  }
  const token = header.slice('bytes='.length).split(',')[0]?.trim();
  if (!token) {
    return null;
  }
  const [startRaw, endRaw] = token.split('-', 2);

  if (startRaw === '' && endRaw !== '') {
    const suffix = Number.parseInt(endRaw, 10);
    if (Number.isNaN(suffix) || suffix <= 0) {
      return null;
    }
    if (suffix >= size) {
      return { start: 0, end: size - 1 };
    }
    return { start: size - suffix, end: size - 1 };
  }

  const start = startRaw !== '' ? Number.parseInt(startRaw, 10) : 0;
  let end = endRaw !== undefined && endRaw !== '' ? Number.parseInt(endRaw, 10) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }
  if (start >= size || start > end) {
    return 'unsatisfiable';
  }
  end = Math.min(end, size - 1);
  return { start, end };
}
