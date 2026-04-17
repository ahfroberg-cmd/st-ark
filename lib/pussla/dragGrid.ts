type PointerToGlobalDeltaInput = {
  clientX: number;
  clientY: number;
  rowLeft: number;
  rowTop: number;
  rowHeight: number;
  colWidth: number;
  startRowIndex: number;
  startCol: number;
  visibleYearCount: number;
  columnsPerYear: number;
  clamp: (value: number, min: number, max: number) => number;
};

export function pointerToGlobalDelta(input: PointerToGlobalDeltaInput): {
  targetRowIndex: number;
  colWithinRow: number;
  deltaColsGlobal: number;
} {
  const {
    clientX,
    clientY,
    rowLeft,
    rowTop,
    rowHeight,
    colWidth,
    startRowIndex,
    startCol,
    visibleYearCount,
    columnsPerYear,
    clamp,
  } = input;

  const localColFloat = (clientX - rowLeft) / colWidth;
  const localCol = Math.floor(localColFloat);
  const overflowRowsByX = Math.floor(localCol / columnsPerYear);
  const relY = clientY - (rowTop + rowHeight / 2);
  const rowsOffsetY = Math.round(relY / rowHeight);
  const rawTargetRow = startRowIndex + rowsOffsetY + overflowRowsByX;
  const targetRowIndex = clamp(rawTargetRow, 0, Math.max(0, visibleYearCount - 1));
  const colWithinRow = ((localCol % columnsPerYear) + columnsPerYear) % columnsPerYear;
  const startColGlobal = startRowIndex * columnsPerYear + startCol;
  const nowColGlobal = targetRowIndex * columnsPerYear + colWithinRow;

  return {
    targetRowIndex,
    colWithinRow,
    deltaColsGlobal: nowColGlobal - startColGlobal,
  };
}
