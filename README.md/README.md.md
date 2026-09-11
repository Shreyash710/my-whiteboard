# 🎨 My Whiteboard

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Platform: Windows](https://img.shields.io/badge/Platform-Windows-lightgrey.svg)
![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-brightgreen.svg)

A high-performance, infinite-canvas whiteboard desktop application built with web technologies. Designed for seamless brainstorming, sketching, and diagramming with a focus on fluid user experience and native performance.

> **[🎥 Place a high-quality GIF here demonstrating the eraser or laser pointer in action]**

## ✨ Core Features

* **Infinite Canvas & Hardware Acceleration:** Buttery smooth trackpad panning and infinite zooming mapped directly to OS scrolling standards.
* **Smart Erasing Engine:** Features an Excalidraw-style time-decay eraser. It creates a sleek, translucent scrubbing trail and seamlessly deletes grouped items upon release.
* **Presentation Laser Pointer (`K`):** A custom, fading laser trail with a perfectly tuned 1.2-second decay specifically designed for screen sharing and presentations.
* **Native File System (Save/Load):** True desktop application behavior. Uses native Windows file picker dialogs to export and import `.board` configuration files, remembering your exact camera viewport position.
* **Dynamic Styling & Custom Cursors:** Context-aware SVG cursors that auto-invert based on the active Dark/Light mode theme.
* **Clipboard Integration:** Instantly paste screenshots directly into the center of your camera viewport using `Ctrl + V`.

## 🛠️ Technology Stack

* **[Electron](https://www.electronjs.org/):** Desktop application framework.
* **[Fabric.js](http://fabricjs.com/):** HTML5 canvas graphics engine and object model.
* **Vanilla HTML / CSS / JS:** Zero heavy frontend frameworks for ultra-fast startup times.

## 🚀 Getting Started (For Developers)

To run this project locally or build your own version, ensure you have [Node.js](https://nodejs.org/) installed.

**1. Clone the repository**
```bash
git clone [https://github.com/YOUR_GITHUB_USERNAME/my-whiteboard.git](https://github.com/YOUR_GITHUB_USERNAME/my-whiteboard.git)
cd my-whiteboard