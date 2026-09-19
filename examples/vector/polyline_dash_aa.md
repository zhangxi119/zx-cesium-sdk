# PolylineDashAAMaterialProperty（抗锯齿虚线材质）

抗锯齿版本的折线虚线材质。用于消除虚线**端面**（实线与间隙交界处）在斜向/细线上的锯齿。

> DC 1.0.8 起，`DC.PolylineDashMaterialProperty` 这个导出**已直接指向本实现**，
> 因此**既有代码零改动**即可获得抗锯齿效果。本类名保留给需要显式指定的场景。

## 为什么需要它

`Cesium.PolylineDashMaterialProperty`（材质 `PolylineDash`）在片元着色器里对 16 位掩码做**硬二值化**：

```glsl
float dashPosition = fract(pos.x / (dashLength * czm_pixelRatio));
float maskIndex = floor(dashPosition * maskLength);
float maskTest = floor(dashPattern / pow(2.0, maskIndex));
vec4 fragColor = (mod(maskTest, 2.0) < 1.0) ? gapColor : color;   // 二选一，无过渡
```

于是端面是硬边，在斜向线与细线上呈现明显锯齿。

**关键点：该锯齿无法靠 MSAA 解决。** MSAA 只在三角形边缘做覆盖率解析，而虚线端面位于折线四边形**内部**（同一三角形内的片元颜色突变）。因此必须在着色器内做解析式抗锯齿。

对照 Cesium 自带的三个折线材质：`PolylineGlowMaterial` 用连续衰减（天然平滑）、`PolylineOutlineMaterial` 调用了 `czm_antialias`（已抗锯齿），**唯独 `PolylineDashMaterial` 没有** —— 本材质即补齐这一处。

## 构造函数

```js
new DC.PolylineDashAAMaterialProperty(options)
```

本类**直接继承** `Cesium.PolylineDashMaterialProperty`，构造参数、属性描述符与取值逻辑与基类**完全一致**，唯一区别是 `getType()` 返回 DC 注册的抗锯齿材质 `PolylineDashAA`。

因此 `instanceof Cesium.PolylineDashMaterialProperty` **仍然成立**，不会影响任何基于基类的判断。

## options 配置表

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `color` | `Cesium.Color` \| `Cesium.Property` | `Color.WHITE` | 实线颜色 |
| `gapColor` | `Cesium.Color` \| `Cesium.Property` | `Color.TRANSPARENT` | 间隙颜色。为透明时仅按覆盖率缩放实线 alpha（保持实线 RGB 不被稀释）；两侧都不透明时按覆盖率线性混合 RGB |
| `dashLength` | `number` \| `Cesium.Property` | `16.0` | 一个虚线周期长度（像素语义，内部已乘 `czm_pixelRatio`） |
| `dashPattern` | `number` \| `Cesium.Property` | `255.0` | 16 位掩码图案。默认 `255` = 前 8 单元实线、后 8 单元间隙 |

## 属性

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `color` | `Cesium.Property` | 实线颜色属性 |
| `gapColor` | `Cesium.Property` | 间隙颜色属性 |
| `dashLength` | `Cesium.Property` | 虚线周期 |
| `dashPattern` | `Cesium.Property` | 16 位掩码 |
| `definitionChanged` | `Cesium.Event` | 任一属性变化时触发（继承自基类） |
| `isConstant` | `boolean` | 所有子属性是否恒定（继承自基类） |

## 方法

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `getType(time)` | `string` | 返回 `Cesium.Material.PolylineDashAAType`（即 `'PolylineDashAA'`） |
| `getValue(time, result)` | `object` | 取当帧材质 uniform（`{ color, gapColor, dashLength, dashPattern }`） |
| `equals(other)` | `boolean` | 与另一属性实例比较（继承自基类，语义一致） |

## 用法示例

最简写法（推荐 —— 既有代码无需改动）：

```js
let polyline = new DC.Polyline('-75, 35; -45, 35')
polyline.setStyle({
  width: 2,
  material: new DC.PolylineDashMaterialProperty({
    color: DC.Color.YELLOW,
    dashLength: 16
  }),
  // 公里级短距连线：跳过大地线加密（DC 1.0.8 起 positions 已是恒定属性）
  arcType: 0
})
layer.addOverlay(polyline)
```

显式指定抗锯齿类（等价）：

```js
material: new DC.PolylineDashAAMaterialProperty({
  color: DC.Color.LIME,
  dashLength: 16
})
```

双色虚线（两侧均不透明）：

```js
material: new DC.PolylineDashMaterialProperty({
  color: DC.Color.CYAN,
  gapColor: DC.Color.RED,
  dashLength: 32
})
```

自定义掩码图案（`dashPattern` 为 16 位整数）：

```js
// 0b1111000011110000 = 61680 → 长短交替的虚线节奏
material: new DC.PolylineDashMaterialProperty({
  color: DC.Color.ORANGE,
  dashPattern: 61680
})
```

完整可运行页面见同目录 [`polyline_dash_aa.html`](polyline_dash_aa.html)（含 1/2/3 px 细线对照与双色虚线对照）。

## 事件

本属性自身不派发地图交互事件。若需点击/悬停回调，走图层的覆盖物事件：

```js
polyline.on(DC.MouseEventType.CLICK, e => {
  console.log('clicked', e)
})
```

## 实现要点（维护须知）

着色器实现见 `src/modules/material/shader/polyline/PolylineDashAAMaterial.glsl`。

```glsl
float maskPos = fract(pos.x / (dashLength * czm_pixelRatio)) * maskLength;
float footprint = fwidth(maskPos);                     // 一个像素跨越多少掩码单元
float tap = clamp(footprint * 0.5, 0.5, 2.0);          // 下限保证无导数时也平滑；上限抑制摩尔纹
float coverage = (dashMask(maskPos - tap) + dashMask(maskPos) + dashMask(maskPos + tap)) / 3.0;
```

三点设计决策：

1. **`fwidth` 的可用性**：WebGL1 由 Cesium 的 `demodernizeShader.js` 自动补 `#extension GL_OES_standard_derivatives : enable`；WebGL2（GLSL ES 3.00）导数是核心特性。守卫统一写作 `#if (__VERSION__ == 300 || defined(GL_OES_standard_derivatives))`（与 Cesium 官方 `PolylineArrowMaterial.glsl` 一致）。
2. **非预乘 alpha 修正**：Cesium 使用 `srcRGB*srcAlpha + dstRGB*(1-srcAlpha)`。若直接 `mix(gapColor, color, coverage)`，默认的透明间隙（`gapColor.a == 0`）会把实线 RGB 一并稀释 → 过渡带**发暗**（细线尤其明显）。故按「较不透明的一侧」取可见色：间隙透明时只缩放 alpha、保留实线 RGB。
3. **可无缝替换**：uniform 集合、默认值（`WHITE` / `TRANSPARENT` / `16` / `255`）、`equals` 语义、`instanceof` 关系全部与基类保持一致（已由 `pnpm verify:perf` 断言覆盖）。

## 注意事项

- **必须配合 MSAA 使用**：本材质只解决虚线端面（三角形内部）的锯齿。折线**边缘**（三角形边缘）的抗锯齿仍依赖 MSAA，因此不要关闭 `scene.msaaSamples`。
- **OIT 会抵消 MSAA**：若 `orderIndependentTranslucency` 为 `true`，半透明图元会被画进**单采样** FBO，MSAA 对其完全失效。DC 1.0.8 起 `Viewer` 的 `DEF_OPTS` 已默认关闭 OIT（可被调用方覆盖）。
- **画布重采样**：`canvas.style.image-rendering` 若为 `pixelated`，超采样收益会被最近邻降采样抵消。DC 1.0.8 起默认写为 `auto`（可用 `imageRendering` 选项还原）。
- **`arcType` 与虚线无关**：`arcType: 0`（`ArcType.NONE`）只用于跳过大地线加密，与端面抗锯齿是两件独立的事。DC-SDK **不导出 `Cesium` 命名空间**，故只能传数值 `0`。
- **不要试图用 `dashLength < 2` 追求"密虚线"**：当虚线周期远小于像素尺寸时会出现摩尔纹，`tap` 的上限 2.0 只能缓解、不能消除。
