type WithId = { id: string };

export function patchEntityById<T extends WithId>(
  list: T[],
  id: string,
  patch: Partial<T>
): T[] {
  return list.map((item) => (item.id === id ? ({ ...item, ...patch } as T) : item));
}
