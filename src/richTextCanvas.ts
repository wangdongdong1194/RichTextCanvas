import type {
  CaretPosition,
  EditorOptions,
  LayoutChar,
  LayoutLine,
  StyledToken,
  TextStyle,
  VerticalAlign,
} from "./type";

export class RichTextCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly measureCtx: CanvasRenderingContext2D;
  private readonly devicePixelRatio: number;
  private canvasCssWidth: number;
  private canvasCssHeight: number;
  // 基础配置
  private readonly options: EditorOptions = {
    width: 200, // 初始宽高，内容超过时会自动扩展
    height: 100, // 初始宽高，内容超过时会自动扩展
    maxCanvasWidth: 4096, // 限制位图尺寸，避免极端输入导致内存暴涨
    maxCanvasHeight: 4096, // 限制位图尺寸，避免极端输入导致内存暴涨
    padding: 5, // 内边距
    lineGap: 0, // 行间距
    background: "#ddd", // 编辑框背景色
    selectionColor: "#62d1f3", // 选区背景色
    caretColor: "black", // 光标颜色
    defaultStyle: {
      fontSize: 18, // 默认字体大小
      fontFamily: "Georgia, serif", // 默认字体
      color: "#222222", // 默认字体颜色
    },
    verticalAlign: "bottom",
    minZoom: 0.1,
  };
  private readonly input: HTMLTextAreaElement;
  private readonly host: HTMLElement;
  private tokens: StyledToken[] = [];
  private lines: LayoutLine[] = [];
  private caretPositions: CaretPosition[] = [];
  private caretIndex = 0;
  private selectionStart = 0;
  private selectionEnd = 0;
  private selectionAnchor: number | null = null;
  private isSelecting = false;
  private preferredCaretX: number | null = null;
  private hasFocus = false;
  private blinkVisible = true;
  private blinkTimer: number | null = null;
  private currentStyle: TextStyle;
  private isComposing = false;
  private inputMirrorValue = "";
  private _zoom = 1;
  private isVisible = true;
  private isDestroyed = false;
  private readonly eventHandlers: {
    input: Set<(text: string) => void>;
    stop: Set<(t: { tokens: StyledToken[]; lines: LayoutLine[] }) => void>;
    keydown: Set<(event: KeyboardEvent) => void>;
    keyup: Set<(event: KeyboardEvent) => void>;
    compositionend: Set<(text: string) => void>;
    change: Set<(text: string) => void>;
  } = {
      input: new Set(),
      stop: new Set(),
      keydown: new Set(),
      keyup: new Set(),
      compositionend: new Set(),
      change: new Set(),
    };
  private readonly measureCache = new Map<string, number>();
  private readonly handleWindowMouseMove = (event: MouseEvent): void => {
    if (!this.isSelecting) {
      return;
    }

    const point = this.getCanvasPoint(event);
    const index = this.getIndexFromPoint(point.x, point.y);
    const anchor = this.selectionAnchor ?? this.caretIndex;

    if (
      index === this.caretIndex &&
      this.selectionStart === anchor &&
      this.selectionEnd === index
    ) {
      return;
    }

    this.caretIndex = index;
    this.selectionStart = anchor;
    this.selectionEnd = index;
    this.preferredCaretX = null;
    this.resetBlink();
    this.render();
  };
  private readonly handleWindowMouseUp = (): void => {
    this.isSelecting = false;
    if (this.selectionStart === this.selectionEnd) {
      this.selectionAnchor = null;
    }
  };

  constructor(mount: HTMLElement, options?: Partial<EditorOptions>) {
    this.host = mount;
    this.options = {
      ...this.options,
      ...options,
      defaultStyle: {
        ...this.options.defaultStyle,
        ...options?.defaultStyle,
      },
      verticalAlign: options?.verticalAlign || this.options.verticalAlign,
    };

    this.currentStyle = { ...this.options.defaultStyle };
    this.devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    this.canvasCssWidth = this.options.width;
    this.canvasCssHeight = this.options.height;

    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.cursor = "text";
    this.canvas.tabIndex = 0;
    this.canvas.style.position = "absolute";

    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is not available");
    }
    this.ctx = context;

    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    if (!measureContext) {
      throw new Error("Canvas 2D context is not available");
    }
    this.measureCtx = measureContext;

    this.applyCanvasSize(this.canvasCssWidth, this.canvasCssHeight);

    this.input = document.createElement("textarea");
    this.input.style.position = "fixed";
    this.input.style.left = "-99999px";
    this.input.style.top = "-99999px";
    this.input.style.opacity = "0";
    this.input.style.pointerEvents = "none";
    this.input.style.width = "1px";
    this.input.style.height = "1px";

    mount.appendChild(this.canvas);
    mount.appendChild(this.input);

    this.bindEvents();
    this.rebuildLayout();
    this.render();
    this.startBlink();
  }

  setFontSize(fontSize: number): void {
    const normalized = Math.max(10, Math.min(64, Math.round(fontSize)));
    const [start, end] = this.getSelectionRange();

    if (start !== end) {
      for (let i = start; i < end; i += 1) {
        const token = this.tokens[i];
        if (token) {
          token.style.fontSize = normalized;
        }
      }
    }

    this.currentStyle.fontSize = normalized;
    this.rebuildLayout();
    this.render();
  }

  setColor(color: string): void {
    const [start, end] = this.getSelectionRange();
    if (start !== end) {
      for (let i = start; i < end; i += 1) {
        const token = this.tokens[i];
        if (token) {
          token.style.color = color;
        }
      }
    }

    this.currentStyle.color = color;
    this.render();
  }

  setZoom(zoom: number): void {
    const normalized = Math.max(this.options.minZoom, zoom);
    if (Number.isNaN(normalized) || normalized === this._zoom) {
      return;
    }

    this._zoom = normalized;
    this.applyCanvasSize(this.canvasCssWidth, this.canvasCssHeight);
    this.resetBlink();
    this.render();
  }

  setPos(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    this.canvas.style.left = `${Math.round(x)}px`;
    this.canvas.style.top = `${Math.round(y)}px`;
  }

  setWidth(width: number): void {
    if (!Number.isFinite(width)) {
      return;
    }
    this.options.width = Math.max(1, Math.round(width));
    this.rebuildLayout();
    this.render();
  }

  setHeight(height: number): void {
    if (!Number.isFinite(height)) {
      return;
    }
    this.options.height = Math.max(1, Math.round(height));
    this.rebuildLayout();
    this.render();
  }

  setSize(width: number, height: number): void {
    this.setWidth(width);
    this.setHeight(height);
  }

  hide(): void {
    if (!this.isVisible) {
      return;
    }
    this.isVisible = false;
    this.canvas.style.display = "none";
    this.input.blur();
    this.hasFocus = false;

    // 清空内容和状态
    this.tokens = [];
    this.lines = [];
    this.caretIndex = 0;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.selectionAnchor = null;
    this.preferredCaretX = null;
    this.inputMirrorValue = "";
    this.input.value = "";
    this.rebuildLayout();
    this.stopBlink();
  }

  show(x: number, y: number): void {
    if (this.isVisible) {
      return;
    }
    this.isVisible = true;
    this.canvas.style.display = "block";
    this.render();
    this.setPos(x, y);
    this.focus();
  }

  isHidden(): boolean {
    return !this.isVisible;
  }

  getText(): string {
    return this.tokens.map((token) => token.value).join("");
  }

  setText(text: string): void {
    const content = text ?? "";
    this.tokens = Array.from(content).map<StyledToken>((char) => ({
      value: char,
      style: { ...this.currentStyle },
    }));
    this.caretIndex = this.tokens.length;
    this.selectionStart = this.caretIndex;
    this.selectionEnd = this.caretIndex;
    this.selectionAnchor = null;
    this.preferredCaretX = null;
    this.rebuildLayout();
    this.resetBlink();
    this.render();
    this.syncInputFromModel(true);
    this.emit("input", this.getText());
  }

  clear(): void {
    this.setText("");
  }

  focus(): void {
    this.focusEditor();
  }

  blur(): void {
    this.input.blur();
    this.hasFocus = false;
    this.render();
  }

  getElement(): HTMLCanvasElement {
    return this.canvas;
  }

  getHostElement(): HTMLElement {
    return this.host;
  }

  getSize(): { width: number; height: number; displayWidth: number; displayHeight: number } {
    return {
      width: this.canvasCssWidth,
      height: this.canvasCssHeight,
      displayWidth: this.canvasCssWidth * this._zoom,
      displayHeight: this.canvasCssHeight * this._zoom,
    };
  }

  getZoom(): number {
    return this._zoom;
  }

  addEventListener(
    event: "input" | "stop",
    handler: Function,
  ): () => void {
    const callback = handler as (value: unknown) => void;
    this.eventHandlers[event].add(callback as never);
    return () => {
      this.eventHandlers[event].delete(callback as never);
    };
  }

  renderRichText(ctx: CanvasRenderingContext2D, devicePixelRatio: number, zoom: number, tokens: StyledToken[], lines: LayoutLine[], verticalAlign: VerticalAlign = 'bottom'): void {
    const bitmapScale = zoom * devicePixelRatio;
    // 根据配置设置 textBaseline
    let textBaseline: CanvasTextBaseline = "top";
    switch (verticalAlign) {
      case "center":
        textBaseline = "middle";
        break;
      case "bottom":
        textBaseline = "bottom";
        break;
      case "top":
      default:
        textBaseline = "top";
    }
    ctx.textBaseline = textBaseline;

    let activeFont = "";

    for (const line of lines) {
      for (const item of line.chars) {
        const token = tokens[item.index];
        if (!token) {
          continue;
        }

        const nextFont = `${token.style.fontSize * bitmapScale}px ${token.style.fontFamily}`;
        if (nextFont !== activeFont) {
          ctx.font = nextFont;
          activeFont = nextFont;
        }
        ctx.fillStyle = token.style.color;
        // 计算 y 坐标
        let y = line.y + 1;
        if (verticalAlign === "center") {
          y = line.y + line.height / 2;
        } else if (verticalAlign === "bottom") {
          y = line.y + line.height - 1;
        }
        ctx.fillText(token.value, item.x * bitmapScale, y * bitmapScale);
      }
    }
  }

  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    this.isDestroyed = true;
    this.stopBlink();
    window.removeEventListener("mousemove", this.handleWindowMouseMove);
    window.removeEventListener("mouseup", this.handleWindowMouseUp);
    this.canvas.remove();
    this.input.remove();
    this.lines = [];
  }

  getLines(): LayoutLine[] {
    return this.lines;
  }

  getToken(): StyledToken[] {
    return this.tokens;
  }

  private bindEvents(): void {
    // 剪切
    this.input.addEventListener("cut", (event) => {
      const [start, end] = this.getSelectionRange();
      if (start !== end) {
        const text = this.tokens
          .slice(start, end)
          .map((t) => t.value)
          .join("");
        event.preventDefault();
        // 写入剪贴板
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text);
        } else if ((event as ClipboardEvent).clipboardData) {
          (event as ClipboardEvent).clipboardData!.setData("text/plain", text);
        }
        this.deleteSelectionIfNeeded();
        this.rebuildLayout();
        this.resetBlink();
        this.render();
        this.syncInputFromModel();
      }
    });

    // 复制
    this.input.addEventListener("copy", (event) => {
      const [start, end] = this.getSelectionRange();
      if (start !== end) {
        const text = this.tokens
          .slice(start, end)
          .map((t) => t.value)
          .join("");
        event.preventDefault();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text);
        } else if ((event as ClipboardEvent).clipboardData) {
          (event as ClipboardEvent).clipboardData!.setData("text/plain", text);
        }
      }
    });

    // 粘贴
    this.input.addEventListener("paste", async (event) => {
      event.preventDefault();
      let text = "";
      if ((event as ClipboardEvent).clipboardData) {
        text = (event as ClipboardEvent).clipboardData!.getData("text/plain");
      } else if (navigator.clipboard) {
        text = await navigator.clipboard.readText();
      }
      if (text) {
        this.insertText(text);
      }
    });
    this.canvas.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const point = this.getCanvasPoint(event);
      const index = this.getIndexFromPoint(point.x, point.y);

      this.focusEditor();
      this.isSelecting = true;
      this.moveCaret(index, event.shiftKey);
      this.selectionAnchor = index;
      this.render();
    });

    window.addEventListener("mousemove", this.handleWindowMouseMove);
    window.addEventListener("mouseup", this.handleWindowMouseUp);

    this.canvas.addEventListener("keydown", (event) => this.onKeyDown(event));
    this.canvas.addEventListener("keyup", (event) => this.emit("keyup", event));
    this.input.addEventListener("keydown", (event) => this.onKeyDown(event));
    this.input.addEventListener("keyup", (event) => this.emit("keyup", event));
    this.input.addEventListener("compositionstart", () => {
      this.isComposing = true;
      this.resetBlink();
      this.syncInputPosition();
    });

    this.input.addEventListener("compositionend", () => {
      this.isComposing = false;
      this.applyInputDiff(this.input.value);
    });

    this.input.addEventListener("input", () => {
      this.applyInputDiff(this.input.value);
    });

    this.input.addEventListener("focus", () => {
      this.hasFocus = true;
      this.resetBlink();
      this.render();
    });

    this.input.addEventListener("blur", () => {
      this.hasFocus = false;
      this.render();
    });
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.emit("keydown", event);

    if (this.isComposing || event.isComposing || event.key === "Process") {
      return;
    }

    const isInputFocused = document.activeElement === this.input;
    const { key, shiftKey } = event;

    if (key === "ArrowLeft") {
      event.preventDefault();
      this.moveHorizontal(-1, shiftKey);
    } else if (key === "ArrowRight") {
      event.preventDefault();
      this.moveHorizontal(1, shiftKey);
    } else if (key === "ArrowUp") {
      event.preventDefault();
      this.moveVertical(-1, shiftKey);
    } else if (key === "ArrowDown") {
      event.preventDefault();
      this.moveVertical(1, shiftKey);
    } else if (key === "Backspace") {
      event.preventDefault();
      this.backspace();
    } else if (key === "Delete") {
      event.preventDefault();
      this.deleteForward();
    } else if (key === "Enter") {
      // 仅 Shift+Enter 插入换行；普通 Enter 退出
      event.preventDefault();
      if (event.shiftKey) {
        this.insertText("\n");
      } else {
        this.emit("stop", {
          lines: [...this.lines],
          tokens: [...this.tokens],
        });
        this.hide();
      }
    } else if (key === "a" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.selectionStart = 0;
      this.selectionEnd = this.tokens.length;
      this.caretIndex = this.tokens.length;
      this.selectionAnchor = 0;
      this.render();
    } else if (
      !isInputFocused &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      key.length === 1
    ) {
      // Printable text should always go through textarea input/composition events.
      event.preventDefault();
      this.focusEditor();
    }
  }

  private focusEditor(): void {
    this.canvas.focus();
    this.syncInputPosition();
    this.syncInputFromModel(true);
    this.input.focus();
    this.hasFocus = true;
    this.resetBlink();
    this.render();
  }

  private insertText(text: string): void {
    const hasSelection = this.selectionStart !== this.selectionEnd;
    this.deleteSelectionIfNeeded();

    const style = { ...this.currentStyle };
    const insertTokens = Array.from(text).map<StyledToken>((char) => ({
      value: char,
      style: { ...style },
    }));

    this.tokens.splice(this.caretIndex, 0, ...insertTokens);
    this.caretIndex += insertTokens.length;
    this.selectionStart = this.caretIndex;
    this.selectionEnd = this.caretIndex;
    this.selectionAnchor = null;
    this.preferredCaretX = null;

    this.rebuildLayout();
    this.resetBlink();
    this.render();
    this.syncInputFromModel();

    this.emit("input", text);
    if (hasSelection || text.length > 0) {
      this.emit("input", this.getText());
    }
  }

  private backspace(): void {
    if (this.deleteSelectionIfNeeded()) {
      this.rebuildLayout();
      this.resetBlink();
      this.render();
      this.syncInputFromModel();
      this.emit("input", this.getText());
      return;
    }

    if (this.caretIndex <= 0) {
      return;
    }

    this.tokens.splice(this.caretIndex - 1, 1);
    this.caretIndex -= 1;
    this.selectionStart = this.caretIndex;
    this.selectionEnd = this.caretIndex;
    this.selectionAnchor = null;
    this.preferredCaretX = null;

    this.rebuildLayout();
    this.resetBlink();
    this.render();
    this.syncInputFromModel();
    this.emit("input", this.getText());
  }

  private deleteForward(): void {
    if (this.deleteSelectionIfNeeded()) {
      this.rebuildLayout();
      this.resetBlink();
      this.render();
      this.syncInputFromModel();
      this.emit("input", this.getText());
      return;
    }

    if (this.caretIndex >= this.tokens.length) {
      return;
    }

    this.tokens.splice(this.caretIndex, 1);
    this.selectionStart = this.caretIndex;
    this.selectionEnd = this.caretIndex;
    this.selectionAnchor = null;
    this.preferredCaretX = null;

    this.rebuildLayout();
    this.resetBlink();
    this.render();
    this.syncInputFromModel();
    this.emit("input", this.getText());
  }

  private deleteSelectionIfNeeded(): boolean {
    const [start, end] = this.getSelectionRange();
    if (start === end) {
      return false;
    }

    this.tokens.splice(start, end - start);
    this.caretIndex = start;
    this.selectionStart = start;
    this.selectionEnd = start;
    this.selectionAnchor = null;
    return true;
  }

  private moveHorizontal(direction: -1 | 1, shiftKey: boolean): void {
    const next = this.clampIndex(this.caretIndex + direction);
    this.moveCaret(next, shiftKey);
  }

  private moveVertical(direction: -1 | 1, shiftKey: boolean): void {
    const currentPosition = this.getCaretPosition(this.caretIndex);
    const targetLineIndex = Math.max(
      0,
      Math.min(this.lines.length - 1, currentPosition.lineIndex + direction),
    );

    if (targetLineIndex === currentPosition.lineIndex) {
      return;
    }

    if (this.preferredCaretX === null) {
      this.preferredCaretX = currentPosition.x;
    }

    const targetLine = this.lines[targetLineIndex];
    if (!targetLine) {
      return;
    }

    const nextIndex = this.getIndexFromXInLine(
      this.preferredCaretX,
      targetLine,
    );
    this.moveCaret(nextIndex, shiftKey, true);
  }

  private moveCaret(
    index: number,
    shiftKey: boolean,
    keepPreferredX = false,
  ): void {
    const normalized = this.clampIndex(index);

    if (shiftKey) {
      if (this.selectionAnchor === null) {
        this.selectionAnchor = this.caretIndex;
      }
      this.caretIndex = normalized;
      this.selectionStart = this.selectionAnchor;
      this.selectionEnd = normalized;
    } else {
      this.caretIndex = normalized;
      this.selectionStart = normalized;
      this.selectionEnd = normalized;
      this.selectionAnchor = null;
    }

    if (!keepPreferredX) {
      this.preferredCaretX = null;
    }
    this.resetBlink();
    this.render();
  }

  private rebuildLayout(): void {
    const padding = this.options.padding;

    this.lines = [];
    this.caretPositions = [];

    let lineIndex = 0;
    let lineStart = 0;
    let lineY = padding;
    let lineHeight = this.options.defaultStyle.fontSize * 1.35;
    let cursorX = padding;

    let chars: LayoutChar[] = [];

    const pushLine = (end: number): void => {
      this.lines.push({
        index: lineIndex,
        y: lineY,
        height: lineHeight,
        start: lineStart,
        end,
        chars,
      });
    };

    for (let i = 0; i < this.tokens.length; i += 1) {
      const token = this.tokens[i];
      if (!token) {
        continue;
      }

      if (token.value === "\n") {
        pushLine(i);

        lineIndex += 1;
        lineStart = i + 1;
        lineY += lineHeight + this.options.lineGap;
        lineHeight = this.options.defaultStyle.fontSize * 1.35;
        cursorX = padding;
        chars = [];
        continue;
      }

      const width = this.getCharWidth(token);

      // 不做自动换行，所有内容都在同一行，除非遇到 \n

      lineHeight = Math.max(lineHeight, token.style.fontSize * 1.35);

      chars.push({
        index: i,
        x: cursorX,
        y: lineY,
        width,
        lineIndex,
      });

      cursorX += width;
    }

    pushLine(this.tokens.length);
    this.rebuildCaretPositions();

    this.caretIndex = this.clampIndex(this.caretIndex);
    this.selectionStart = this.clampIndex(this.selectionStart);
    this.selectionEnd = this.clampIndex(this.selectionEnd);

    this.updateCanvasSize();
  }

  private rebuildCaretPositions(): void {
    const positions: CaretPosition[] = new Array(this.tokens.length + 1);

    for (const line of this.lines) {
      if (line.chars.length === 0) {
        positions[line.start] = {
          x: this.options.padding,
          y: line.y,
          lineIndex: line.index,
          lineHeight: line.height,
        };
        continue;
      }

      for (const char of line.chars) {
        positions[char.index] = {
          x: char.x,
          y: line.y,
          lineIndex: line.index,
          lineHeight: line.height,
        };

        positions[char.index + 1] = {
          x: char.x + char.width,
          y: line.y,
          lineIndex: line.index,
          lineHeight: line.height,
        };
      }
    }

    this.caretPositions = positions;
  }

  // 根据内容动态调整 canvas 尺寸
  private updateCanvasSize(): void {
    // 最小宽高
    const minWidth = this.options.width;
    const minHeight = this.options.height;
    let maxLineWidth = 0;
    let totalHeight = 0;
    if (this.lines.length > 0) {
      for (const line of this.lines) {
        if (line.chars.length > 0) {
          const lastChar = line.chars[line.chars.length - 1];
          if (lastChar) {
            const lineWidth =
              lastChar.x + lastChar.width + this.options.padding;
            maxLineWidth = Math.max(maxLineWidth, lineWidth);
          }
        } else {
          // 空行宽度为 padding*2
          maxLineWidth = Math.max(maxLineWidth, this.options.padding * 2);
        }
        totalHeight = line.y + line.height;
      }

      totalHeight += this.options.padding;
    } else {
      maxLineWidth = this.options.width;
      totalHeight = this.options.height;
    }

    const newWidth = Math.min(
      this.options.maxCanvasWidth,
      Math.max(minWidth, Math.ceil(maxLineWidth)),
    );
    const newHeight = Math.min(
      this.options.maxCanvasHeight,
      Math.max(minHeight, Math.ceil(totalHeight)),
    );

    if (
      this.canvasCssWidth !== newWidth ||
      this.canvasCssHeight !== newHeight
    ) {
      this.applyCanvasSize(newWidth, newHeight);
    }
  }

  private applyCanvasSize(width: number, height: number): void {
    this.canvasCssWidth = width;
    this.canvasCssHeight = height;

    const displayWidth = width * this._zoom;
    const displayHeight = height * this._zoom;
    const bitmapScale = this.getBitmapScale();

    this.canvas.width = Math.max(1, Math.round(width * bitmapScale));
    this.canvas.height = Math.max(1, Math.round(height * bitmapScale));
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
  }

  private render(): void {
    const [start, end] = this.getSelectionRange();
    const bitmapScale = this.getBitmapScale();

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = this.options.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 根据配置设置 textBaseline
    let textBaseline: CanvasTextBaseline = "top";
    switch (this.options.verticalAlign) {
      case "center":
        textBaseline = "middle";
        break;
      case "bottom":
        textBaseline = "bottom";
        break;
      case "top":
      default:
        textBaseline = "top";
    }
    this.ctx.textBaseline = textBaseline;

    let activeFont = "";

    for (const line of this.lines) {
      for (const item of line.chars) {
        const token = this.tokens[item.index];
        if (!token) {
          continue;
        }

        if (item.index >= start && item.index < end) {
          this.ctx.fillStyle = this.options.selectionColor;
          this.ctx.fillRect(
            item.x * bitmapScale,
            line.y * bitmapScale,
            item.width * bitmapScale,
            line.height * bitmapScale,
          );
        }

        const nextFont = `${token.style.fontSize * bitmapScale}px ${token.style.fontFamily}`;
        if (nextFont !== activeFont) {
          this.ctx.font = nextFont;
          activeFont = nextFont;
        }
        this.ctx.fillStyle = token.style.color;
        // 计算 y 坐标
        let y = line.y + 1;
        if (this.options.verticalAlign === "center") {
          y = line.y + line.height / 2;
        } else if (this.options.verticalAlign === "bottom") {
          y = line.y + line.height - 1;
        }
        this.ctx.fillText(token.value, item.x * bitmapScale, y * bitmapScale);
      }
    }

    if (this.hasFocus && this.blinkVisible && start === end) {
      const caret = this.getCaretPosition(this.caretIndex);
      const currentLine = this.lines[caret.lineIndex];
      const isEmptyLine = !currentLine || currentLine.chars.length === 0;

      let caretHeight = caret.lineHeight;
      if (!isEmptyLine) {
        const leftToken =
          this.caretIndex > 0 ? this.tokens[this.caretIndex - 1] : undefined;
        const rightToken =
          this.caretIndex < this.tokens.length
            ? this.tokens[this.caretIndex]
            : undefined;

        const leftHeight =
          leftToken && leftToken.value !== "\n"
            ? leftToken.style.fontSize * 1.35
            : 0;
        const rightHeight =
          rightToken && rightToken.value !== "\n"
            ? rightToken.style.fontSize * 1.35
            : 0;

        const neighborHeight = Math.max(leftHeight, rightHeight);
        if (neighborHeight > 0) {
          caretHeight = neighborHeight;
        }
      }

      const height = Math.max(12, Math.floor(caretHeight - 2));
      // 计算 y 坐标
      let y = caret.y + 1;
      if (this.options.verticalAlign === "center") {
        y = caret.y + (caret.lineHeight - height) / 2;
      } else if (this.options.verticalAlign === "bottom") {
        y = caret.y + caret.lineHeight - height - 1;
      }
      this.ctx.fillStyle = this.options.caretColor;
      this.ctx.fillRect(
        caret.x * bitmapScale,
        y * bitmapScale,
        Math.max(1, 1.4 * bitmapScale),
        height * bitmapScale,
      );
    }

    if (this.hasFocus) {
      this.syncInputPosition();
    }

    this.drawBorder();
  }

  private syncInputPosition(): void {
    const caret = this.getCaretPosition(this.caretIndex);
    const rect = this.canvas.getBoundingClientRect();
    const left = rect.left + caret.x * this._zoom;
    const top = rect.top + (caret.y + caret.lineHeight) * this._zoom;

    this.input.style.left = `${Math.round(left)}px`;
    this.input.style.top = `${Math.round(top)}px`;
  }
  /**
   * 绘制边框，聚焦时加粗并变色
   */
  private drawBorder(): void {
    // this.ctx.strokeStyle = this.hasFocus ? "green" : "#d8dde6";
    // this.ctx.lineWidth = this.hasFocus ? 2 : 1;
    // this.ctx.strokeRect(1, 1, this.options.width - 2, this.options.height - 2);
  }

  private getCanvasPoint(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / this._zoom,
      y: (event.clientY - rect.top) / this._zoom,
    };
  }

  private getIndexFromPoint(x: number, y: number): number {
    if (this.lines.length === 0) {
      return 0;
    }

    let line: LayoutLine | undefined = this.lines[0];
    for (const candidate of this.lines) {
      if (y >= candidate.y && y <= candidate.y + candidate.height) {
        line = candidate;
        break;
      }

      if (y > candidate.y + candidate.height) {
        line = candidate;
      }
    }

    if (!line) {
      return 0;
    }

    return this.getIndexFromXInLine(x, line);
  }

  private getIndexFromXInLine(x: number, line: LayoutLine): number {
    if (line.chars.length === 0) {
      return line.start;
    }

    for (const char of line.chars) {
      const middle = char.x + char.width / 2;
      if (x < middle) {
        return char.index;
      }
      if (x <= char.x + char.width) {
        return char.index + 1;
      }
    }

    return line.end;
  }

  private getSelectionRange(): [number, number] {
    return this.selectionStart <= this.selectionEnd
      ? [this.selectionStart, this.selectionEnd]
      : [this.selectionEnd, this.selectionStart];
  }

  private getCaretPosition(index: number): CaretPosition {
    const clamped = this.clampIndex(index);
    const cached = this.caretPositions[clamped];
    if (cached) {
      return cached;
    }

    const lastLine = this.lines[this.lines.length - 1];
    if (lastLine) {
      return {
        x: this.options.padding,
        y: lastLine.y,
        lineIndex: lastLine.index,
        lineHeight: lastLine.height,
      };
    }

    return {
      x: this.options.padding,
      y: this.options.padding,
      lineIndex: 0,
      lineHeight: this.options.defaultStyle.fontSize * 1.35,
    };
  }

  private clampIndex(index: number): number {
    return Math.max(0, Math.min(this.tokens.length, index));
  }

  private getCharWidth(token: StyledToken): number {
    const font = `${token.style.fontSize}px ${token.style.fontFamily}`;
    const key = `${font}\u0000${token.value}`;
    const cached = this.measureCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    this.measureCtx.font = font;
    const measuredWidth = this.measureCtx.measureText(token.value).width;
    const width = Math.max(1, measuredWidth);

    if (this.measureCache.size > 2000) {
      this.measureCache.clear();
    }
    this.measureCache.set(key, width);
    return width;
  }

  private getBitmapScale(): number {
    return this._zoom * this.devicePixelRatio;
  }

  private syncInputFromModel(force = false): void {
    if (this.isComposing && !force) {
      return;
    }

    const text = this.getText();
    if (this.input.value !== text) {
      this.input.value = text;
    }
    this.inputMirrorValue = text;

    const [start, end] = this.getSelectionRange();
    if (
      this.input.selectionStart !== start ||
      this.input.selectionEnd !== end
    ) {
      this.input.setSelectionRange(start, end);
    }
  }

  private applyInputDiff(nextValue: string): void {
    const prevValue = this.inputMirrorValue;
    if (nextValue === prevValue) {
      return;
    }

    const prevChars = Array.from(prevValue);
    const nextChars = Array.from(nextValue);

    let prefix = 0;
    while (
      prefix < prevChars.length &&
      prefix < nextChars.length &&
      prevChars[prefix] === nextChars[prefix]
    ) {
      prefix += 1;
    }

    let suffix = 0;
    while (
      suffix < prevChars.length - prefix &&
      suffix < nextChars.length - prefix &&
      prevChars[prevChars.length - 1 - suffix] ===
      nextChars[nextChars.length - 1 - suffix]
    ) {
      suffix += 1;
    }

    const removedCount = prevChars.length - prefix - suffix;
    const insertedChars = nextChars.slice(prefix, nextChars.length - suffix);
    const style = { ...this.currentStyle };
    const insertedTokens = insertedChars.map<StyledToken>((char) => ({
      value: char,
      style: { ...style },
    }));

    this.tokens.splice(prefix, removedCount, ...insertedTokens);

    const selectionStart = this.codeUnitToCharIndex(
      nextValue,
      this.input.selectionStart ?? nextValue.length,
    );
    const selectionEnd = this.codeUnitToCharIndex(
      nextValue,
      this.input.selectionEnd ?? nextValue.length,
    );

    this.selectionStart = this.clampIndex(selectionStart);
    this.selectionEnd = this.clampIndex(selectionEnd);
    this.caretIndex = this.selectionEnd;
    this.selectionAnchor =
      this.selectionStart === this.selectionEnd ? null : this.selectionStart;
    this.preferredCaretX = null;

    this.inputMirrorValue = nextValue;
    this.rebuildLayout();
    this.resetBlink();
    this.render();
    this.emit("input", this.getText());
  }

  private codeUnitToCharIndex(text: string, codeUnitIndex: number): number {
    const normalized = Math.max(0, Math.min(text.length, codeUnitIndex));
    return Array.from(text.slice(0, normalized)).length;
  }

  private startBlink(): void {
    this.stopBlink();
    this.blinkTimer = window.setInterval(() => {
      this.blinkVisible = !this.blinkVisible;
      this.render();
    }, 520);
  }

  private stopBlink(): void {
    if (this.blinkTimer !== null) {
      window.clearInterval(this.blinkTimer);
      this.blinkTimer = null;
    }
  }

  private resetBlink(): void {
    this.blinkVisible = true;
  }

  private emit(
    event: "input" | "stop" | "keydown" | "keyup" | "compositionend" | "change",
    payload: string | KeyboardEvent | { tokens: StyledToken[]; lines: LayoutLine[] },
  ): void {
    const handlers = this.eventHandlers[event];
    if (!handlers || handlers.size === 0) {
      return;
    }
    for (const handler of handlers) {
      handler(payload as never);
    }
  }
}
