import { RichTextCanvas } from "./richTextCanvas";

const app = document.querySelector<HTMLDivElement>("#canvas-root");

if (!app) {
  throw new Error("Cannot find #canvas-root");
}

app.style.width = "100%";
app.style.minHeight = "400px";

const editorWidth = 900;

const toolbar = document.createElement("div");
toolbar.style.width = `${editorWidth}px`;
toolbar.style.display = "flex";

const sizeRange = document.createElement("input");
sizeRange.type = "range";
sizeRange.min = "10";
sizeRange.max = "48";
sizeRange.value = "18";

const colorInput = document.createElement("input");
colorInput.type = "color";
colorInput.value = "#222222";
colorInput.style.width = "30px";
colorInput.style.height = "30px";
colorInput.style.background = "transparent";

toolbar.append(sizeRange, colorInput);
app.appendChild(toolbar);

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

window.addEventListener("beforeunload", () => {
  editor.destroy();
});
