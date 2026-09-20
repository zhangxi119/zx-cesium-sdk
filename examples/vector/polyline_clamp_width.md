# Polyline 线宽语义保护（`clampLineWidth`）

把折线宽度规整到安全区间的**可选开关**。用于避免业务配置越界导致的**静默异常**。

> **默认关闭**：不传开关时 `setStyle` 完全按调用方给的值写入，与既有版本行为一致。

## 为什么需要它

业务线宽多来自后端配置或可视化表单，越界值很容易出现，而 Cesium 对越界的反应是**静默的**：

| 越界情况 | 源码依据 | 现象 |
| --- | --- | --- |
| `width < 1` | `PolylineVS`：`if (width < 1.0) { show = 0.0; }` | **整条线不绘制** —— 表现为「配了 0.5，结果这条线凭空消失」，排查成本极高 |
| `width` 过大 | 顶点着色器按 `expandWidth * czm_pixelRatio` 展开四边形 | 极宽的四边形大面积遮挡地图，并按面积消耗填充率（性能问题） |

> ⚠ **不做像素比换算（重要更正）**：Cesium 折线 `width` 的语义**就是 CSS 像素**，
> 其顶点着色器内部已执行 `expandWidth * czm_pixelRatio`
> （见 `PolylineCommon.getPolylineWindowCoordinatesEC`）。曾按「绘制缓冲区像素」的推测再乘一次
> 有效像素比，会让线宽成倍变粗 —— 该推测已被源码否定。

## `setStyle` 的线宽开关

| 开关 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `clampLineWidth` | `boolean` | `false` | `true` 时把本次传入的 `width` 经 `Util.clampLineWidth` 钳制到 `[1, 12]` |
| `strictLineWidth` | `boolean` | `false` | `true` 时**否决**钳制（优先级更高），用于个别确实需要越界线宽的图元 |

两个开关都会被**消费掉**（在写入 Cesium 前 `delete`），不会变成实体上的无用属性。

```js
let polyline = new DC.Polyline('-75, 35; -45, 35')

// 1) 默认：原样写入（width=0.5 会让整条线不绘制）
polyline.setStyle({ width: 0.5 })

// 2) 开启保护：0.5 → 1
polyline.setStyle({ width: 0.5, clampLineWidth: true })

// 3) 开启保护 + 逃生舱：100 原样写入
polyline.setStyle({ width: 100, clampLineWidth: true, strictLineWidth: true })
```

| 写入 `width` | 开关 | 实体实际 `width` |
| --- | --- | --- |
| `0.5` | 无 | `0.5`（**不绘制**） |
| `0.5` | `clampLineWidth` | `1` |
| `100` | 无 | `100` |
| `100` | `clampLineWidth` | `12` |
| `3.5` | `clampLineWidth` | `3.5`（区间内不取整） |
| `0.5` | `clampLineWidth` + `strictLineWidth` | `0.5`（**不绘制**，逃生舱生效） |
| `NaN` | `clampLineWidth` | `1`（非法值落到下限） |

## `Util.clampLineWidth(width, range?)`

开关背后使用的工具方法，也可单独调用（例如在做业务侧线宽收口时）。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `width` | `number` | — | 待规整的线宽（CSS 像素） |
| `range` | `{ min?: number, max?: number }` | `{ min: 1, max: 12 }` | 目标区间 |

| 返回值 | 说明 |
| --- | --- |
| `number` | 规整后的线宽；非法入参（非数值 / `≤ 0`）返回 `min` |

```js
DC.Util.clampLineWidth(0) // → 1
DC.Util.clampLineWidth(99) // → 12
DC.Util.clampLineWidth(5, { min: 2, max: 4 }) // → 4
DC.Util.clampLineWidth('abc') // → 1
```

## 注意事项

1. **只作用于本次调用传入的 `width`**：不传 `width` 时不会去改动已有线宽；
2. **只作用于 `Polyline.setStyle`**：`PolylinePrimitive`（Primitive 路线）与各材质属性不在其范围内，
   如需要请自行调用 `Util.clampLineWidth`；
3. **默认区间 `[1, 12]` 是库层给的保守值**，业务上限（例如「最粗 8px」）仍应由使用方在
   自身配置层收口 —— 库层只保证「不会因越界而静默异常」；
4. 与 2D（Leaflet）链路无关：Leaflet 的 `weight` 语义不同，不受本开关影响。

## 示例

完整可运行示例见 `examples/vector/polyline_clamp_width.html`：同屏并列 6 条线，
分别覆盖「不钳制 / 钳制 / 区间内 / 逃生舱」四种情况，并在面板上回读实体上的真实线宽。
