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
