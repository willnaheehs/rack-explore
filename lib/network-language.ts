// Presentation only: keep source URLs, stable IDs and portable files unchanged.
export function networkText(text: string): string;
export function networkText(
  text: string | null | undefined,
): string | null | undefined;
export function networkText(
  text: string | null | undefined,
): string | null | undefined {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\bInfinity Fabric\b/g, 'AMD GPU interconnect')
    .replace(/\bFABRICS\b/g, 'NETWORKS')
    .replace(/\bFABRIC\b/g, 'NETWORK')
    .replace(/\bFabrics\b/g, 'Networks')
    .replace(/\bFabric\b/g, 'Network')
    .replace(/\bfabrics\b/g, 'networks')
    .replace(/\bfabric\b/g, 'network');
}

const textFields = new Set([
  'name',
  'title',
  'subtitle',
  'label',
  'value',
  'description',
  'detail',
  'summary',
  'scope',
  'section',
  'note',
  'message',
  'area',
  'limitations',
  'model',
  'family',
  'role',
  'protocol',
  'medium',
  'fromPort',
  'toPort',
]);

export function networkLabels<T>(value: T, field = ''): T {
  if (typeof value === 'string')
    return (
      textFields.has(field) && !/^https?:\/\//.test(value)
        ? networkText(value)
        : value
    ) as T;
  if (Array.isArray(value))
    return value.map((item) => networkLabels(item, field)) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        networkLabels(item, key),
      ]),
    ) as T;
  return value;
}
