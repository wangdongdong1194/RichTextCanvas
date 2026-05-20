import { RichTextCanvas } from "./richTextCanvas";

const app = document.querySelector<HTMLDivElement>("#canvas-root");

if (!app) {
  throw new Error("Cannot find #canvas-root");
}

app.style.width = "100%";
app.style.minHeight = "400px";

const editorWidth = 900;


const sizeRange = document.getElementById("size") as HTMLInputElement;
const colorInput = document.getElementById("color") as HTMLInputElement;
const zoomRange = document.getElementById("zoom") as HTMLInputElement;


app.appendChild(sizeRange);
app.appendChild(colorInput);
app.appendChild(zoomRange);

const canvasMount = document.createElement("div");
canvasMount.style.width = `${editorWidth}px`;
app.appendChild(canvasMount);

const editor = new RichTextCanvas(canvasMount);

sizeRange.addEventListener("input", () => {
  const value = Number(sizeRange.value);
  editor.setFontSize(value);
});

colorInput.addEventListener("input", () => {
  editor.setColor(colorInput.value);
});
zoomRange.addEventListener("input", () => {
  const value = Number(zoomRange.value);
  editor.setZoom(value);
});

window.addEventListener("beforeunload", () => {
  editor.destroy();
});

// editor.setText("Hello.\n这是一个富文asdfasf本画布编辑器。");
// const ctx = editor._getCtx();
// const lines = [{ "index": 0, "y": 5, "height": 24.3, "start": 0, "end": 5, "chars": [{ "index": 0, "x": 5, "y": 5, "width": 14.6689453125, "lineIndex": 0 }, { "index": 1, "x": 19.6689453125, "y": 5, "width": 8.701171875, "lineIndex": 0 }, { "index": 2, "x": 28.3701171875, "y": 5, "width": 5.150390625, "lineIndex": 0 }, { "index": 3, "x": 33.5205078125, "y": 5, "width": 5.150390625, "lineIndex": 0 }, { "index": 4, "x": 38.6708984375, "y": 5, "width": 9.703125, "lineIndex": 0 }] }, { "index": 1, "y": 29.3, "height": 24.3, "start": 6, "end": 26, "chars": [{ "index": 6, "x": 5, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 7, "x": 23, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 8, "x": 41, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 9, "x": 59, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 10, "x": 77, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 11, "x": 95, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 12, "x": 113, "y": 29.3, "width": 9.0703125, "lineIndex": 1 }, { "index": 13, "x": 122.0703125, "y": 29.3, "width": 7.7783203125, "lineIndex": 1 }, { "index": 14, "x": 129.8486328125, "y": 29.3, "width": 10.3359375, "lineIndex": 1 }, { "index": 15, "x": 140.1845703125, "y": 29.3, "width": 5.853515625, "lineIndex": 1 }, { "index": 16, "x": 146.0380859375, "y": 29.3, "width": 9.0703125, "lineIndex": 1 }, { "index": 17, "x": 155.1083984375, "y": 29.3, "width": 7.7783203125, "lineIndex": 1 }, { "index": 18, "x": 162.88671875, "y": 29.3, "width": 5.853515625, "lineIndex": 1 }, { "index": 19, "x": 168.740234375, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 20, "x": 186.740234375, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 21, "x": 204.740234375, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 22, "x": 222.740234375, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 23, "x": 240.740234375, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 24, "x": 258.740234375, "y": 29.3, "width": 18, "lineIndex": 1 }, { "index": 25, "x": 276.740234375, "y": 29.3, "width": 18, "lineIndex": 1 }] }];
// const tokens = [{ "value": "H", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "e", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "l", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "l", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "o", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "\n", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "这", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "是", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "一", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "个", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "富", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "文", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "a", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "s", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "d", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "f", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "a", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "s", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "f", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "本", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "画", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "布", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "编", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "辑", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "器", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }, { "value": "。", "style": { "fontSize": 18, "fontFamily": "Georgia, serif", "color": "#222222" } }];
// editor.renderRichText(ctx, window.devicePixelRatio, 1, tokens, lines);

editor.addEventListener('input', () => {
  console.log('尺寸', editor.getSize());
  console.log('行信息', JSON.stringify(editor.getLines()));
  console.log('Token信息', JSON.stringify(editor.getToken()));
});
