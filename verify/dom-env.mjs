/**
 * 验证脚本共用的 DOM 环境搭建
 *
 * - 用 jsdom 提供 DOM（Cesium 的 `cesium` 伞包在模块顶层依赖 DOM）；
 * - 为 `HTMLCanvasElement.getContext` 打桩（jsdom 未实现 Canvas 2D/WebGL，
 *   需另装 `canvas` 原生包），仅保证 Cesium 的 `FeatureDetection` 不抛异常。
 *
 * 用法：在脚本**最顶部** `import './dom-env.mjs'`（必须在动态导入 Cesium 之前）。
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"></div></body></html>',
  { pretendToBeVisual: true, url: 'http://localhost/' }
)
const { window } = dom

globalThis.window = window
globalThis.document = window.document
for (const key of [
  'HTMLElement',
  'HTMLCanvasElement',
  'HTMLDivElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'DOMParser',
  'XMLHttpRequest',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'MutationObserver',
  'DeviceOrientationEvent',
  'DeviceMotionEvent',
]) {
  if (window[key] !== undefined && globalThis[key] === undefined) {
    globalThis[key] = window[key]
  }
}
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator,
    configurable: true,
    writable: true,
  })
} catch {
  // Node 高版本的 navigator 可能不可覆盖：忽略
}

const originalGetContext = window.HTMLCanvasElement.prototype.getContext

window.HTMLCanvasElement.prototype.getContext = function getContext(
  type,
  ...rest
) {
  if (type === '2d') {
    return {
      canvas: this,
      getImageData: (x, y, w, h) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: () => {},
      drawImage: () => {},
      fillRect: () => {},
      clearRect: () => {},
      measureText: () => ({ width: 0 }),
      fillText: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      stroke: () => {},
      fill: () => {},
      setLineDash: () => {},
    }
  }
  if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
    const target = {
      canvas: this,
      drawingBufferWidth: 2,
      drawingBufferHeight: 2,
      getExtension: () => null,
      getSupportedExtensions: () => [],
      getParameter: () => 0,
      getShaderPrecisionFormat: () => ({
        precision: 23,
        rangeMin: 127,
        rangeMax: 127,
      }),
      createProgram: () => ({}),
      createShader: () => ({}),
      createBuffer: () => ({}),
      createTexture: () => ({}),
      createFramebuffer: () => ({}),
      createRenderbuffer: () => ({}),
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      getUniformLocation: () => ({}),
      getAttribLocation: () => 0,
      checkFramebufferStatus: () => 36053,
      isContextLost: () => false,
    }
    return new Proxy(target, {
      get(t, prop) {
        if (prop in t) {
          return t[prop]
        }
        return () => undefined
      },
    })
  }
  return originalGetContext ? originalGetContext.call(this, type, ...rest) : null
}

export { dom, window }
