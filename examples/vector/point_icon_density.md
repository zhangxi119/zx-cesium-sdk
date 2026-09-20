# CustomBillboard 图标纹理密度（`pixelDensity`）

让 billboard 图标在「绘制缓冲区小于屏幕物理像素」时依然锐利：**纹理密度与视觉尺寸解耦**，
并联动**图标预栅格化**。

> **默认关闭**：`pixelDensity` 默认 `1`，行为与既有版本逐像素一致。

## 为什么需要它（两层根因）

### 第一层：绘制缓冲区可能只有 CSS 尺寸

`Entity.billboard` 的图标被栅格化成一个纹理四边形，上屏尺寸由 `width/height` 决定，纹理密度也由同一组数值决定。
当绘制缓冲区小于屏幕物理像素时（例如按 CSS 像素渲染而屏幕 `devicePixelRatio = 2`），
1 个纹理像素会被铺到 2×2 个物理像素上 → **发虚**。

### 第二层：Cesium 从不按 `width/height` 重新栅格化图片

见 Cesium `Resource._Implementations.loadImageElement`：

```js
const image = new Image()
image.onload = function () {
  if (image.naturalWidth === 0 && image.naturalHeight === 0) {
    image.width = 300
    image.height = 150 // 仅在完全没有尺寸信息时才兜底
  }
  deferred.resolve(image)
}
image.src = url // ← 没有任何 image.width = billboard.width 之类的预设
```

也就是说**纹理永远来自 `<img>` 的固有尺寸**：把 `width/height` 放大 2 倍，若图片本身只有 82×69，
它依然会被拉伸到 164×138 的纹理上。

## 做法

`pixelDensity` 一个开关同时解决两层：

1. `width/height` 放大 `density` 倍（提升纹理密度）；
2. `scale = 1 / density`（**视觉尺寸逐像素不变**）；
3. 密度 > 1 时，把图标按「视觉尺寸 × 密度」画进一张 canvas，再以 data URL 写回 `billboard.image`
   （对 SVG 无损；对位图相当于把 GPU 双线性放大换成 CPU 高质量重采样）；
4. 按「url + 尺寸」缓存，并发去重，失败时保持原图标（不影响可用性）。

## 构造函数

```js
new DC.CustomBillboard(position, icon)
```

## 属性

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `pixelDensity` | `number` \| `boolean` | `1` | 纹理密度。`true` = 按 `window.devicePixelRatio`；`≤ 1` / 非法值 = 关闭；上限 `4` |
| `size` | `[number, number]` | `[32, 32]` | **视觉尺寸**（CSS 像素）。开启密度后仍传视觉尺寸，不要传放大后的值 |
| `icon` | `string` | — | 图标地址。**换图后会自动重新预栅格化**（密度开启时） |

## 方法

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `setStyle(style)` | `CustomBillboard` | 透传给 `Entity.billboard`。密度开启且未显式传 `scale` 时，会兜底重写 `scale = 1/density`（显式传入的 `scale` 优先） |
| `Viewer.resolvePixelDensity()` | `number` | 读取推荐密度：`window.devicePixelRatio ÷ scene.pixelRatio`，恒 `≥ 1`、`≤ 4`（`Viewer` 上的配套方法） |

## 用法示例

```js
let billboard = new DC.CustomBillboard(position, '../assets/icon/camera.png')
// 1) 先给视觉尺寸（CSS 像素）
billboard.size = [48, 48]
// 2) ⚠ 必须在 addTo 之后再设置密度：`_mountedHook` 会按视觉尺寸重写 width/height
billboard.addTo(layer)
billboard.pixelDensity = viewer.resolvePixelDensity()
```

密度换算与预栅格化的对应关系（视觉尺寸 48×48）：

| `pixelDensity` | 纹理尺寸 | `scale` | 屏幕视觉尺寸 | 预栅格化 |
| --- | --- | --- | --- | --- |
| `1`（默认） | 48×48 | 由调用方决定（不写入） | 48×48 | 否 |
| `2` | 96×96 | `0.5` | 48×48 | 是（96×96） |
| `4` | 192×192 | `0.25` | 48×48 | 是（192×192） |
| `true` | `48 × dpr` | `1/dpr` | 48×48 | 是 |

## 注意事项

1. **时序**：密度必须在 `addTo` **之后**设置。`_mountedHook` 会写回 `this.size` 与 `this.icon`，
   提前设置会被覆盖（库层在 `_mountedHook` 内也会补一次，但使用方不应依赖这一点）；
2. **代价**：单张图标的纹理像素量按 `density²` 增长（一般 80×60 → 160×120，量级很小），
   与整屏 `resolutionScale` 的超采样开销不是一个量级；
3. **密度 ≤ 1 时零开销**：不写入额外属性、不做任何栅格化，行为与未开启时完全一致；
4. **`density = true` 的语义是「补到屏幕物理像素」**：若绘制缓冲区本身已是物理像素
   （`useDevicePixelRatio = true`），`resolvePixelDensity()` 会返回 `1`，不会重复放大；
5. **缓存在库层按「url + 尺寸」复用**，不随组件挂载次数增长；库层未提供公开的清理入口，
   若确需释放请整体销毁/重建场景（缓存规模有界：图标种类 × 尺寸数）。

## 相关

- 示例：`examples/vector/point_icon_density.html`（同屏对照 `1 / 2 / 4 / true` 四种密度 + 换图标演示）
- 渲染档位与诊断：`examples/setting/render_quality.html`
