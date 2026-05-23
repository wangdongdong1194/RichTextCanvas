export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
}

export interface StyledToken {
  value: string;
  style: TextStyle;
}

export interface CaretPosition {
  x: number;
  y: number;
  lineIndex: number;
  lineHeight: number;
}

export interface LayoutChar {
  index: number;
  x: number;
  y: number;
  width: number;
  lineIndex: number;
}

export interface LayoutLine {
  index: number;
  y: number;
  height: number;
  start: number;
  end: number;
  chars: LayoutChar[];
  boxDescent: number; // 字符下方的距离，用于调整基线位置
}

export type TextBaseline = "top" | "middle" | "bottom";

export interface EditorOptions {
  width: number;
  height: number;
  maxCanvasWidth: number;
  maxCanvasHeight: number;
  padding: number;
  lineGap: number;
  background: string;
  selectionColor: string;
  caretColor: string;
  defaultStyle: TextStyle;
  textBaseline: TextBaseline;
  minZoom: number;
}
