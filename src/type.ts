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
}

export type VerticalAlign = "top" | "center" | "bottom";

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
  verticalAlign: VerticalAlign;
  minZoom: number;
}
