export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function sortValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, JsonValue>;
    const sortedEntries = Object.keys(obj)
      .sort()
      .map((key) => [key, sortValue(obj[key])] as const);
    return Object.fromEntries(sortedEntries);
  }

  return value;
}

export function canonicalize(input: JsonValue): string {
  return JSON.stringify(sortValue(input));
}
