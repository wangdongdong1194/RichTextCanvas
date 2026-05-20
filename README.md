# rich_text_canvas

一个基于 Canvas 的轻量富文本输入组件，支持多行输入和基础文本样式。

## 安装

```bash
npm i rich_text_canvas
```

## 基本使用

```ts
import { RichTextCanvas } from "rich_text_canvas";

const canvas = document.getElementById("editor") as HTMLCanvasElement;

const editor = new RichTextCanvas(canvas, {
	placeholder: "请输入内容",
});
```

## 本地开发

```bash
npm run dev
npm run build
```
# 