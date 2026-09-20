# 渲染档位 / 性能快照 / 能力自检

面向「性能与画质调优」的三个 `Viewer` 能力：

| 能力 | API | 作用 |
| --- | --- | --- |
| 渲染档位 | `viewer.setRenderQuality(options)` / `viewer.getRenderQuality()` | 把「档位」写入 Cesium 原生渲染参数 |
| 性能快照 | `viewer.getPerformanceSnapshot()` | 读取**真实生效**的参数与绘制规模 |
| 能力自检 | `DC.selfCheck({ viewer })` | 断言使用方收益所依赖的库默认值是否仍然成立 |

> **库层只提供机制，档位数值由使用方决定**：哪个档位用多少 `resolutionScale` / `msaaSamples`
> 属于业务策略，库层不内置预设表。

## `setRenderQuality(options)`

直接写 Cesium 原生对象，**不经过 `setOptions` 的整体重放** —— 因此不会像
`setOptions({ resolutionScale })` 那样把 `msaaSamples` 重置回 1、把大气层开关重置回 `true`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `resolutionScale` | `number` | 绘制缓冲区缩放（`> 1` 为超采样，填充率按**平方**增长） |
| `useDevicePixelRatio` | `boolean` | `false` = 按 CSS 像素渲染（性能优先）；`true` = 按屏幕物理像素（清晰优先） |
| `targetFrameRate` | `number \| null` | 渲染循环帧率上限（`null` = 不限帧） |
| `msaaSamples` | `number` | 硬件多重采样数（几何抗锯齿，对折线/虚线边缘真实生效） |
| `fxaa` | `boolean` | 图像空间抗锯齿（与 MSAA 叠加属重复投入，且会糊化细线） |
| `sunBloom` | `boolean` | 太阳光晕（每帧多个全屏 pass） |
| `orderIndependentTranslucency` | `boolean` | 顺序无关半透明。⚠ `true` 时半透明图元走单采样 FBO，**MSAA 失效** |
| `imageRendering` | `string` | 画布重采样方式（`'auto'` 平滑 / `'pixelated'` 最近邻） |
| `groundAtmosphere` | `boolean` | 地面大气散射（全屏级逐片元开销） |
| `skyAtmosphere` | `boolean` | 天空与太阳/月亮 |
| `maximumScreenSpaceError` | `number` | 地球瓦片最大屏幕空间误差（越大瓦片越少、画面越糊） |

**全部字段可选，只写传入项。** 写入后触发一次 `requestRender()`。

```js
viewer.setRenderQuality({
  resolutionScale: 1,
  useDevicePixelRatio: false,
  msaaSamples: 4,
  fxaa: false,
  sunBloom: false,
  maximumScreenSpaceError: 2
})
```

## `getRenderQuality()`

返回「期望值 + 真实生效值」，两者不一致通常意味着被 `setOptions` 或其它代码覆盖 ——
这是定位「档位没生效」的第一手线索。

```js
const { requested, effective } = viewer.getRenderQuality()
```

## `getPerformanceSnapshot()`

直接读 Cesium 原生对象上的值（**不是** DC 的 `_options`，后者可能只是期望值）。

| 字段 | 说明 |
| --- | --- |
| `resolutionScale` / `useBrowserRecommendedResolution` / `targetFrameRate` | 分辨率与帧率策略 |
| `msaaSamples` / `msaaSupported` / `fxaa` / `sunBloom` / `orderIndependentTranslucency` | 决定观感与填充率的抗锯齿链路 |
| `imageRendering` | 画布重采样方式（`'pixelated'` 会让超采样收益被最近邻抵消） |
| `groundAtmosphere` / `skyAtmosphere` / `maximumScreenSpaceError` | 大气层与瓦片精度 |
| `pixelRatio` / `canvasWidth` / `canvasHeight` / `pixels` | 真实绘制缓冲区规模（判断超采样是否被误开） |
| `drawCommands` / `primitives` / `globeTiles` | 渲染规模，用于定位性能瓶颈 |
| `available` | viewer 未就绪时为 `false` |

## `DC.selfCheck({ viewer })`

使用方的性能/画质收益往往建立在库层的**具体默认值**上（都是"看不见的默认值"）：
半透明线能否吃到 MSAA 取决于 `orderIndependentTranslucency` 默认 `false`、
超采样会不会被最近邻抵消取决于画布默认 `image-rendering: auto`、虚线端面是否平滑取决于虚线材质指向 AA 实现……
这些默认值一旦被改回，表现会**静默退化**（不报错，只是"又慢了 / 又有锯齿了"）。
`selfCheck` 把它们断言出来。

| 返回字段 | 类型 | 说明 |
| --- | --- | --- |
| `ok` | `boolean` | 是否全部命中（不含 `skip`） |
| `warnCount` | `number` | 未命中项数量 |
| `items` | `SelfCheckItem[]` | 明细：`{ key, name, status, detail }`，`status ∈ pass / warn / skip` |

**特性**：只读（不修改任何状态、不做猴补）、绝不抛错（单项异常降级为 `warn`）、
诚实（运行期无法判定的项标记 `skip`，不伪装成通过）。

```js
const report = DC.selfCheck({ viewer })
console.table(report.items)
```

## 注意事项

1. `orderIndependentTranslucency` 属**初始化期**参数，运行期改动在部分 Cesium 版本上不生效，
   应在 `new Viewer({ orderIndependentTranslucency })` 时指定；
2. `setRenderQuality` **不修改** `_options`：后续若有人调用 `setOptions`，同名项仍可能被 DC 选项覆盖——
   建议在 `setOptions` **之后**调用本方法，且运行期不要反复 `setOptions`；
3. 快照与自检的调用成本：快照会读取 `frameState.commandList.length` 等只读字段，
   适合放在诊断面板（如按 3 秒周期刷新），**不要**放进每帧回调；
4. `selfCheck` 只覆盖「库层行为」，不检测使用方自身的渲染参数 —— 两者结合才是完整的调优闭环。

## 示例

完整可运行示例见 `examples/setting/render_quality.html`：三个档位按钮 + 实时面板
（自上而下依次为「期望值 → 真实生效值 → 绘制规模 → 自检明细」）。
