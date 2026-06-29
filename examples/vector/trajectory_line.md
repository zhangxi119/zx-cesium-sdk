# TrajectoryLine 点阵线（发光线）

点阵线覆盖物：使用发光线（`PolylineGlowMaterialProperty`）绘制线体，分点使用 Canvas 径向渐变的发光点 billboard 展示，点尺寸头大尾小，支持鼠标移入提示。直接使用坐标点数组静态渲染。

## 构造函数

```javascript
new DC.TrajectoryLine(positions, options)
```

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `positions` | `Position[]` \| `string` | 轨迹坐标点数组，支持 `Position` 数组或字符串格式（如 `'-75, 35; -80, 35'`） |
| `options` | `Object` | 可选配置 |

### options 配置项

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `showPoints` | `boolean` | `true` | 是否显示分点位 |
| `lineStyle` | `Object` | 见下 | 发光线样式 |
| `pointStyle` | `Object` | 见下 | 发光点样式 |
| `tooltipContent` | `Function` | `null` | 提示内容回调 `(index, position, allPositions) => string` |
| `tooltipTrigger` | `string` | `'both'` | tooltip 触发方式：`'hover'`（悬停）、`'click'`（点击）、`'both'`（两者均可） |

#### lineStyle 发光线样式

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `color` | `Cesium.Color` | `#00FFFF` | 线颜色 |
| `width` | `number` | `4` | 线宽（像素） |
| `glowPower` | `number` | `0.25` | 发光强度（仅 `dash: false` 时生效） |
| `dash` | `boolean` | `false` | 是否使用发光虚线，`true` 时使用 `PolylineDashMaterialProperty` |
| `dashLength` | `number` | `16` | 虚线段长度（仅 `dash: true` 时生效） |
| `dashPattern` | `number` | `255` | 虚线位掩码图案（仅 `dash: true` 时生效） |
| `clampToGround` | `boolean` | `false` | 是否贴地 |
| `material` | `MaterialProperty` | — | 自定义材质，传入后覆盖默认发光/虚线材质 |

#### pointStyle 发光点样式

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `pointSize` | `number` | `24` | 点最大尺寸（像素），渐变时为最大端的尺寸 |
| `pointColor` | `Cesium.Color` | `#FFFF00` | 点颜色 |
| `pointGradient` | `boolean` | `true` | 是否启用点尺寸渐变，`false` 时所有点统一为 `pointSize` |
| `pointGradientDirection` | `string` | `'ascend'` | 渐变方向：`'ascend'`（首小尾大）、`'descend'`（首大尾小） |

> **点尺寸规则**：
> - `pointGradient: false` → 所有点统一为 `pointSize`。
> - `pointGradientDirection: 'ascend'`（默认）→ 头部点最小为 `pointSize / 3`，尾部点最大为 `pointSize`，中间点按索引线性插值。
> - `pointGradientDirection: 'descend'` → 头部点最大为 `pointSize`，尾部点最小为 `pointSize / 3`，中间点按索引线性插值。

## 方法

### setStyle(style)

设置发光线样式。传入 `color` / `glowPower` / `dash` 等会重建线材质；传入 `material` 则使用自定义材质。

```javascript
// 发光实线
trajectory.setStyle({
  color: DC.Color.RED,
  width: 6,
  glowPower: 0.3,
})

// 切换为发光虚线
trajectory.setStyle({
  dash: true,
  dashLength: 20,
  dashPattern: 255,
})
```

### setPointStyle(style)

设置发光点样式。仅更新颜色时不会重建 entity，直接替换 billboard 图片；更新 `pointSize` / `pointGradient` / `pointGradientDirection` 时通过 `CallbackProperty` 自动响应，无需重建。

```javascript
// 更新颜色和尺寸
trajectory.setPointStyle({
  pointSize: 32,
  pointColor: DC.Color.ORANGE,
})

// 切换为不渐变（统一大小）
trajectory.setPointStyle({
  pointGradient: false,
})

// 切换渐变方向为首大尾小
trajectory.setPointStyle({
  pointGradient: true,
  pointGradientDirection: 'descend',
})
```

### setTooltipContent(callback)

设置分点提示内容回调。触发方式由 `tooltipTrigger` 配置决定（`'hover'` / `'click'` / `'both'`）。

```javascript
trajectory.setTooltipContent(function (index, pos, allPositions) {
  return '点 #' + (index + 1) + '<br/>经度: ' + pos.lng.toFixed(6) + '<br/>纬度: ' + pos.lat.toFixed(6)
})
```

## 动态更新

TrajectoryLine 支持创建后动态更新坐标、点位显隐、触发模式等，所有更新均为增量操作，不会全量重建 entity，避免闪烁。

### positions setter

全量替换坐标数组，内部做 diff：新增的点位追加 entity，减少的点位移除 entity，数量不变时仅更新坐标值（通过 `CallbackProperty` 自动响应）。

```javascript
// 全量替换坐标
trajectory.positions = [
  new DC.Position(120.38, 31.10, 1000),
  new DC.Position(120.39, 31.11, 1200),
  new DC.Position(120.40, 31.12, 1500),
]
```

### addPosition(position, index?)

在末尾或指定索引处添加一个坐标点，自动追加对应的 billboard entity。

| 参数 | 类型 | 说明 |
|------|------|------|
| `position` | `Position` \| `string` | 要添加的坐标点 |
| `index` | `number?` | 插入位置索引，省略或 >= 数组长度时追加到末尾 |

```javascript
// 追加到末尾
trajectory.addPosition(new DC.Position(120.41, 31.13, 1500))

// 插入到索引 2 处
trajectory.addPosition(new DC.Position(120.395, 31.115, 1300), 2)
```

### removePositionAt(index)

移除指定索引的坐标点及对应 entity。

| 参数 | 类型 | 说明 |
|------|------|------|
| `index` | `number` | 要移除的坐标点索引 |

```javascript
trajectory.removePositionAt(3)
```

### removePosition(position)

按坐标值查找并移除坐标点（经纬度及高度均匹配时移除）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `position` | `Position` \| `string` | 要移除的坐标点 |

```javascript
trajectory.removePosition(new DC.Position(120.41, 31.13, 1500))
```

### showPoints getter/setter

动态切换分点显隐，无需重建 entity。

```javascript
// 隐藏分点
trajectory.showPoints = false

// 显示分点
trajectory.showPoints = true

// 读取当前状态
console.log(trajectory.showPoints)
```

### tooltipTrigger getter/setter

动态切换 tooltip 触发方式，自动注册/注销 viewer 级 click 事件。

```javascript
// 切换为仅点击触发
trajectory.tooltipTrigger = 'click'

// 切换为仅悬停触发
trajectory.tooltipTrigger = 'hover'

// 切换为两者均可
trajectory.tooltipTrigger = 'both'

// 读取当前触发模式
console.log(trajectory.tooltipTrigger)
```

## 事件

通过 `on()` 方法订阅事件，与 SDK 其他 Overlay 一致。**需在 `layer.addOverlay(trajectory)` 之后注册**，以确保富载荷字段可用。

当鼠标交互发生在分点上时，事件回调的 `e` 对象会注入以下富载荷字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `e.trajectoryIndex` | `number` | 分点索引（从 0 开始） |
| `e.trajectoryPosition` | `Position` | 分点坐标（WGS84） |
| `e.trajectoryPositions` | `Position[]` | 所有轨迹坐标点 |

支持的事件类型：`CLICK`, `MOUSE_OVER`, `MOUSE_OUT`, `MOUSE_MOVE` 等。

```javascript
// 点击分点
trajectory.on(DC.MouseEventType.CLICK, function (e) {
  if (e.trajectoryIndex === undefined) return
  console.log('点击轨迹点 #' + (e.trajectoryIndex + 1), e.trajectoryPosition)
})

// 鼠标移入分点
trajectory.on(DC.MouseEventType.MOUSE_OVER, function (e) {
  if (e.trajectoryIndex === undefined) return
  console.log('移入轨迹点 #' + (e.trajectoryIndex + 1))
})

// 鼠标移出分点
trajectory.on(DC.MouseEventType.MOUSE_OUT, function (e) {
  console.log('移出轨迹点')
})
```

## 使用示例

```javascript
// 1. 创建 Viewer，开启鼠标拾取
let viewer = new DC.Viewer('viewer-container')
viewer.enableMouseOver = true
viewer.enableMouseMovePick = true

// 2. 创建图层
let layer = new DC.VectorLayer('layer')
viewer.addLayer(layer)

// 3. 生成轨迹坐标
let positions = [
  new DC.Position(120.38, 31.10, 1000),
  new DC.Position(120.39, 31.11, 1200),
  new DC.Position(120.40, 31.12, 1500),
]

// 4. 创建点阵线（发光线 + 发光点）
let trajectory = new DC.TrajectoryLine(positions, {
  showPoints: true,
  lineStyle: {
    color: DC.Color.fromCssColorString('#00FFFF'),
    width: 5,
    glowPower: 0.25,
    clampToGround: false,
    dash: true, // true=发光虚线, false=发光实线
    dashLength: 20,
    dashPattern: 255,
  },
  pointStyle: {
    pointSize: 28, // 头部点尺寸，尾部点为其 1/3
    pointColor: DC.Color.fromCssColorString('#FFFF00'),
  },
  tooltipTrigger: 'both', // 'hover' | 'click' | 'both'
})

// 5. 设置提示内容
trajectory.setTooltipContent(function (index, pos) {
  return '轨迹点 #' + (index + 1) + '<br/>高度: ' + pos.alt.toFixed(1) + 'm'
})

// 6. 添加到图层（直接静态渲染）
layer.addOverlay(trajectory)

// 7. 监听点位事件（需在 addOverlay 之后注册）
trajectory.on(DC.MouseEventType.CLICK, function (e) {
  if (e.trajectoryIndex === undefined) return
  console.log('点击轨迹点 #' + (e.trajectoryIndex + 1), e.trajectoryPosition)
})

// 8. 飞到轨迹
viewer.flyTo(layer)
```

## 注意事项

- **鼠标提示功能**需要手动开启 `viewer.enableMouseOver = true` 和 `viewer.enableMouseMovePick = true`，否则 `MOUSE_OVER` / `MOUSE_OUT` 事件不会触发。
- **发光线**默认使用 Cesium 原生 `PolylineGlowMaterialProperty`（发光实线），设置 `dash: true` 后切换为 `PolylineDashMaterialProperty`（发光虚线），可通过 `setStyle({ material: ... })` 完全自定义材质。
- **发光点**由 Canvas 径向渐变图生成 billboard，按颜色缓存；点尺寸头大尾小（尾点为头点的 1/3）。
- **分点 Entity** 的 `overlayId` 指向 `TrajectoryLine` 实例，鼠标拾取后会正确派发事件到当前 overlay。
- **tooltip 触发方式**通过 `tooltipTrigger` 配置，支持 `'hover'`（悬停）、`'click'`（点击）、`'both'`（两者均可），默认 `'both'`，运行时可通过 setter 动态切换。
- **事件富载荷**：在分点上触发 `CLICK` / `MOUSE_OVER` / `MOUSE_OUT` 时，回调 `e` 对象注入 `trajectoryIndex`、`trajectoryPosition`、`trajectoryPositions` 字段，需在 `addOverlay` 之后注册 `.on()` 以确保字段可用。
- **动态更新**：`positions` setter、`addPosition`、`removePositionAt`、`removePosition` 均为增量操作，通过 `CallbackProperty` 自动响应坐标和尺寸变化，不会全量重建 entity，避免闪烁。
- **showPoints 切换**：通过 setter 动切换显隐时，已创建的 entity 仅切换 `show` 属性，不会销毁重建；从隐藏切换为显示时若 entity 不存在则自动创建。
