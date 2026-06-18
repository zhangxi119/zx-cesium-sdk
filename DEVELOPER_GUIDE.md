# DC-SDK（zx-cesium-sdk）框架架构与开发文档

> 本文档面向 SDK 二次开发者，帮助你理解框架的封装结构、设计模式，并具备独立开发新组件与问题修复的能力。

---

## 一、项目概述

`zx-cesium-sdk` 是基于 **Cesium 1.137** 构建的二次开发框架，定位为 **2D/3D 一体化 WebGIS 应用 SDK**。它通过**代理模式**对 Cesium 原生 API 进行上层封装，统一了 `Entity`、`Primitive`、`DataSource`、`DOM` 等多种渲染体系，提供了标准化的图层、覆盖物、事件、Widget、材质扩展机制。

- **构建工具**：esbuild（支持 `IIFE` 与 `ESM` 两种输出格式）
- **源码目录**：`e:\githubProjects\dc-sdk-master\src`
- **构建配置**：`e:\githubProjects\dc-sdk-master\gulpfile.js`

---

## 二、目录结构

```
src/
├── index.js                  // SDK 入口：导出 config、全部模块
├── DC.js                     // 构建时动态生成的临时入口（gulp 拼接版本信息）
├── global-api/               // 全局参数与外部库注册
│   ├── parameter.js          // setParam / getParam（如 baseUrl）
│   └── lib-utils.js          // registerLib / getLib（第三方库挂载）
├── libs/
│   └── index.js              // Cesium 与 Supercluster 的统一出口
├── modules/
│   ├── viewer/               // Viewer 核心封装
│   ├── position/             // Position 坐标对象
│   ├── transform/            // 坐标转换工具
│   ├── parse/                // 坐标解析工具
│   ├── utils/                // Util / DomUtil / PlotUtil
│   ├── state/                // State 状态枚举
│   ├── event/                // 事件系统（基类 + 各类事件定义）
│   ├── option/               // ViewerOption / CameraOption / MouseMode
│   ├── imagery/              // 影像图层相关
│   ├── terrain/              // 地形相关
│   ├── layer/                // 图层基类 + 各类型图层
│   ├── overlay/              // 覆盖物基类 + 各类型覆盖物
│   ├── material/             // Shader 材质扩展
│   ├── widget/               // Widget 基类 + 各内置组件
│   ├── tools/                // DrawTool / EditTool
│   ├── animation/            // 动画相关
│   ├── effect/               // 特效
│   ├── weather/              // 天气
│   ├── measure/              // 量算
│   ├── plot/                 // 标绘
│   ├── heat-map/             // 热力图
│   ├── wind/                 // 风场
│   └── chart/                // 图表图层
└── themes/                   // SCSS 样式主题
```

---

## 三、核心设计模式

### 3.1 代理模式（Delegate）

框架几乎所有核心类都不直接继承 Cesium 原生对象，而是**内部持有一个 Cesium 原生实例作为 `_delegate`**。

**示例**：`@e:\githubProjects\dc-sdk-master\src\modules\viewer\Viewer.js:54`
```javascript
this._delegate = new Cesium.CesiumWidget(container, { ...DEF_OPTS, ...options })
```

**意义**：
- 对外屏蔽 Cesium 复杂的构造函数和参数差异。
- 可在上层统一拦截、扩展或重写行为。
- 各子系统（Layer、Overlay、Widget）均通过 `delegate` 属性访问原生对象。

### 3.2 钩子模式（Hook）

基类通过定义 `_xxxHook` 空方法，子类按需覆盖，实现生命周期管理。

| 基类 | 钩子 | 触发时机 |
|------|------|----------|
| `Layer` | `_onAdd(viewer)` `_onRemove()` `_addedHook()` `_removedHook()` | 图层被添加到/从 Viewer 移除 |
| `Overlay` | `_mountedHook()` `_addedHook()` `_removedHook()` `_onAdd(layer)` `_onRemove()` | 覆盖物被添加到/从图层移除 |
| `Widget` | `_installHook()` `_enableHook()` `_mountContent()` `_bindEvent()` `_unbindEvent()` | Widget 安装/启用/禁用 |

### 3.3 事件驱动模式

所有核心对象（Viewer、Layer、Overlay、Widget）都内置了独立的事件系统，基于 `Cesium.Event` 实现。

**事件基类**：`@e:\githubProjects\dc-sdk-master\src\modules\event\Event.js:7`
```javascript
class Event {
  constructor(types) { /* 根据类型字典预注册 Cesium.Event 实例 */ }
  on(type, callback, context) { /* 订阅 */ }
  off(type, callback, context) { /* 取消订阅 */ }
  fire(type, params) { /* 触发 */ }
}
```

### 3.4 注册表模式（Type Registry）

`Layer`、`Overlay`、`Widget` 均带有静态注册方法，用于扩展类型系统，避免硬编码字符串。

```javascript
Layer.registerType('myLayer')     // 注册 Layer 类型
Overlay.registerType('myOverlay') // 注册 Overlay 类型
Widget.registerType('myWidget')     // 注册 Widget 类型
```

---

## 四、核心模块详解

### 4.1 Viewer 封装

**文件**：`@e:\githubProjects\dc-sdk-master\src\modules\viewer\Viewer.js`

Viewer 不是继承 `Cesium.Viewer`，而是内部代理 `Cesium.CesiumWidget`，并在此基础上聚合了以下子系统：

- **事件系统**：`MouseEvent`、`ViewerEvent`、`SceneEvent`
- **配置系统**：`ViewerOption`（场景、地球、相机、画布配置）、`CameraOption`（俯仰角限制、鼠标模式）
- **图层管理器**：`_layerCache` / `_layerGroupCache`，支持 `addLayer/removeLayer/getLayers`
- **Widget 容器**：`_widgetContainer`（DOM 层）
- **图层容器**：`_layerContainer`（DOM 层，用于 HtmlLayer）
- **底图选择器**：`BaseLayerPicker`
- **插件机制**：`_use(plugin)`，所有 Widget 和 Tool 都作为插件 `install` 到 Viewer 上

**常用 API 风格**：链式调用（返回 `this`）。

### 4.2 坐标系统

**Position 对象**：`@e:\githubProjects\dc-sdk-master\src\modules\position\Position.js`

统一使用自定义的 `Position` 类表示经纬度高程姿态，包含：
- `lng`, `lat`, `alt`
- `heading`, `pitch`, `roll`

**转换器**：`@e:\githubProjects\dc-sdk-master\src\modules\transform\Transform.js`

提供静态方法完成以下转换：
- `Cartesian3 ↔ WGS84`
- `Cartographic ↔ WGS84`
- `WGS84 ↔ Mercator`
- `Window(pixel) ↔ WGS84`

### 4.3 图层系统（Layer）

**基类**：`@e:\githubProjects\dc-sdk-master\src\modules\layer\Layer.js`

核心职责：
1. 管理 `_delegate`（Cesium 原生集合或 DataSource）。
2. 管理 `_cache`（`overlayId → Overlay` 的缓存）。
3. 生命周期：`_onAdd` 自动将 `PrimitiveCollection` / `ImageryLayer` / `DataSource` 挂载到 Viewer 对应系统。

**现有图层类型**（`@e:\githubProjects\dc-sdk-master\src\modules\layer\type\`）：

| 图层类 | 底层 Cesium 对象 | 用途 |
|--------|------------------|------|
| `VectorLayer` | `CustomDataSource` | 管理 Entity 类型覆盖物 |
| `PrimitiveLayer` | `PrimitiveCollection` | 管理 Primitive 类型覆盖物 |
| `GroundPrimitiveLayer` | `GroundPrimitiveCollection` | 贴地 Primitive |
| `HtmlLayer` | `div` DOM | 管理 DivIcon 等 DOM 覆盖物 |
| `ClusterLayer` | `CustomDataSource` + `supercluster` | 点聚合 |
| `TilesetLayer` | `Cesium3DTileset` | 3D Tiles |
| `GeoJsonLayer` | `GeoJsonDataSource` | GeoJSON |
| `CzmlLayer` | `CzmlDataSource` | CZML |
| `RasterTileLayer` | `ImageryLayer` | 栅格影像 |

**示例**：`@e:\githubProjects\dc-sdk-master\src\modules\layer\type\PrimitiveLayer.js:12`
```javascript
class PrimitiveLayer extends Layer {
  constructor(id) {
    super(id)
    this._delegate = new Cesium.PrimitiveCollection()
    this._points = this._delegate.add(new Cesium.PointPrimitiveCollection())
    this._labels = this._delegate.add(new Cesium.LabelCollection())
    this._billboards = this._delegate.add(new Cesium.BillboardCollection())
    this._polylines = this._delegate.add(new Cesium.PolylineCollection())
    this._clouds = this._delegate.add(new Cesium.CloudCollection())
  }
}
```

### 4.4 覆盖物系统（Overlay）

**基类**：`@e:\githubProjects\dc-sdk-master\src\modules\overlay\Overlay.js`

核心设计：
- 每个 Overlay 都有 `_id`（内部 UUID）和 `_bid`（业务 ID，即 `overlay.id`）。
- `_delegate` 可以是 `Entity`、`Primitive`、Promise（异步模型）、甚至一个普通对象字面量（由 PrimitiveCollection 创建时使用）。
- `_onAdd` 方法内实现了**自动路由**：根据 `layer.delegate` 的类型自动决定是 `entities.add()`、还是 `collection.add()`、还是直接 `layer.delegate.add()`。

**覆盖物分类**：

| 类别 | 目录 | 说明 |
|------|------|------|
| Vector | `overlay/vector/` | 基于 `Cesium.Entity`（Billboard、Point、Polygon、Polyline...） |
| Primitive | `overlay/primitive/` | 基于 `Cesium.Primitive` / `BillboardCollection` 等，性能更高 |
| HTML | `overlay/html/` | `DivIcon`，DOM 元素，挂载在 `HtmlLayer` |
| Model | `overlay/model/` | `Model`、`Tileset`、`I3S` |
| Plot | `overlay/plot/` | 标绘箭头（AttackArrow、DoubleArrow 等） |
| Custom | `overlay/custom/` | 自定义 Billboard / Label |
| Dynamic | `overlay/dynamic/` | 动态 Billboard / Model |

**Entity vs Primitive 的选择**：
- 需要动态样式、时间动态、标签复杂样式 → `Vector（Entity）`
- 海量静态点、线，追求帧率 → `Primitive`

### 4.5 事件系统

**文件**：`@e:\githubProjects\dc-sdk-master\src\modules\event\`

- `Event.js`：基类，封装 `Cesium.Event`。
- `EventType.js`：定义了所有事件类型常量。
- `type/` 目录下按作用域细分：`MouseEvent`、`ViewerEvent`、`SceneEvent`、`OverlayEvent`、`LayerEvent`、`PlotEvent` 等。

**Viewer 事件绑定**：
```javascript
viewer.on('click', callback)        // 鼠标点击
viewer.on('cameraMoveEnd', callback) // 相机停止移动
viewer.on('addLayer', callback)      // 图层添加
```

**Overlay 事件绑定**：
```javascript
overlay.on('click', callback)
overlay.on('mouseover', callback)
```

### 4.6 Widget 系统

**基类**：`@e:\githubProjects\dc-sdk-master\src\modules\widget\Widget.js`

Widget 是**基于 DOM 的地图 UI 组件**，如 Popup、Tooltip、Compass、鹰眼图、地图切换、分屏等。

**生命周期**：
1. `install(viewer)`：安装到 Viewer，执行 `_installHook`。
2. `enable = true/false`：控制显隐，触发 `_enableHook` → `_mountContent()` / `_bindEvent()`。
3. 通过 `postRender` 事件将 3D 世界坐标实时映射到屏幕像素坐标（如 Popup 跟随地表点）。

**Popup 典型实现**：`@e:\githubProjects\dc-sdk-master\src\modules\widget\type\Popup.js`
- 监听 `scene.postRender`，调用 `Cesium.SceneTransforms.worldToWindowCoordinates` 计算屏幕坐标。
- 通过 CSS `transform: translate3d` 更新 DOM 位置。

### 4.7 Material 材质系统

**架构**：自定义 Shader 材质分为三层：

1. **Shader 源码**：`material/shader/` 下的 `.glsl` 文件（由 `esbuild-plugin-glsl` 内联为字符串）。
2. **Material 注册**：`material/type/` 下的 `.js` 文件，调用 `Cesium.Material._materialCache.addMaterial(...)` 将 GLSL 注册到 Cesium 全局材质缓存。
3. **MaterialProperty 封装**：`material/property/` 下的类，继承 `MaterialProperty` 基类，用于 Entity 材质属性动态更新。

**基类**：`@e:\githubProjects\dc-sdk-master\src\modules\material\MaterialProperty.js:7`
```javascript
class MaterialProperty {
  constructor(options = {}) {
    this._definitionChanged = new Cesium.Event()
    this.color = options.color || Cesium.Color.fromBytes(0, 255, 255, 255)
    this.speed = options.speed || 1
  }
  getType(time) { return null }
  getValue(time, result) { return result ?? {} }
  equals(other) { return this === other }
}
```

**开发新材质的标准步骤**：
1. 在 `material/shader/<category>/` 下编写 `.glsl`。
2. 在 `material/type/<category>.js` 中通过 `Cesium.Material._materialCache.addMaterial` 注册，关联 uniforms 和 source。
3. 如需用于 Entity，在 `material/property/` 下继承 `MaterialProperty`，实现 `getType`、`getValue`、`equals`。
4. 在 `material/index.js` 中导出。

### 4.8 工具系统（Tools）

**DrawTool**：`@e:\githubProjects\dc-sdk-master\src\modules\tools\DrawTool.js`
- 通过 `viewer.on` 监听鼠标点击、移动、右键完成。
- 内部维护 `CustomDataSource` 存储绘制过程中的锚点（Anchor）。
- 对外暴露 `PlotEventType` 事件（`DRAW_START`、`DRAW_ANCHOR`、`DRAW_STOP` 等），标绘组件在此基础上实现具体图形绘制。

**EditTool**：同理，用于编辑模式下的控制点交互。

---

## 五、如何开发新组件

### 5.1 开发新的 Overlay（以自定义 Entity 为例）

**继承关系**：`MyOverlay → Overlay`

**必须实现**：
- `get type()`：返回通过 `Overlay.registerType('my_overlay')` 注册的类型字符串。
- `constructor(...)`：创建 `this._delegate = new Cesium.Entity(...)` 或对应对象。
- `_mountedHook()`：将构造函数参数同步到 `_delegate`，触发位置/样式初始化。
- （可选）`setStyle(style)`：合并样式。

**示例模板**：
```javascript
import Overlay from '../Overlay'
import State from '../../state/State'
import Parse from '../../parse/Parse'
import { Transform } from '../../transform'

class MyOverlay extends Overlay {
  constructor(position) {
    super()
    this._delegate = new Cesium.Entity({ point: { pixelSize: 10 } })
    this._position = Parse.parsePosition(position)
    this._state = State.INITIALIZED
  }

  get type() {
    return Overlay.getOverlayType('my_overlay')
  }

  _mountedHook() {
    this._delegate.position = Transform.transformWGS84ToCartesian(this._position)
  }

  set position(position) {
    this._position = Parse.parsePosition(position)
    this._delegate.position = Transform.transformWGS84ToCartesian(this._position)
  }

  get position() {
    return this._position
  }
}

Overlay.registerType('my_overlay')
export default MyOverlay
```

**添加到图层**：
```javascript
const layer = new VectorLayer('myLayer')
viewer.addLayer(layer)
layer.addOverlay(new MyOverlay([116.39, 39.9]))
```

### 5.2 开发新的 Layer

**继承关系**：`MyLayer → Layer`

**必须实现**：
- `get type()`
- `constructor(id)`：创建 `this._delegate`。
- `clear()`：清空内部数据。

**添加到 Viewer**：
```javascript
viewer.addLayer(new MyLayer('id'))
```

### 5.3 开发新的 Widget

**继承关系**：`MyWidget → Widget`

**必须实现**：
- `get type()`
- `constructor()`：创建 `this._wrapper = DomUtil.create('div', 'widget my-widget')`
- `_installHook()`：通过 `Object.defineProperty(viewer, 'myWidget', { get() { return self } })` 挂载到 Viewer。
- `_mountContent()`：初始化 DOM 内容。
- `_bindEvent()`：绑定 `scene.postRender` 等事件。
- `_updateWindowCoord(windowCoord)`：将 3D 坐标转为屏幕坐标更新 DOM。

### 5.4 开发新的 Material

**步骤**：
1. `src/modules/material/shader/my/MyMaterial.glsl`
2. `src/modules/material/type/my.js` 中注册：
```javascript
Cesium.Material.MyType = 'MyType'
Cesium.Material._materialCache.addMaterial(Cesium.Material.MyType, {
  fabric: { type: Cesium.Material.MyType, uniforms: { color: ... }, source: MyGlsl },
  translucent: () => true
})
```
3. （Entity 动态用）创建 `MyMaterialProperty extends MaterialProperty`，实现 `getType() { return Cesium.Material.MyType }`。

---

## 六、常见问题修复指南

### 6.1 Overlay 添加到图层后不显示
- 检查 `_delegate` 是否在 `_mountedHook()` 中被正确初始化。
- 检查 `type` 是否已在基类 `registerType`。
- 对于 Primitive 类型，确认是否添加到了正确的 `PrimitiveLayer`，且该 Layer 已被 `viewer.addLayer()`。

### 6.2 Entity 样式设置无效
- `setStyle` 中是否使用了 `Util.merge(this._delegate.billboard, style)`？注意某些属性（如 `image`、`width`、`height`）可能被 `delete` 掉了，需单独在 setter 中维护。

**示例**：`@e:\githubProjects\dc-sdk-master\src\modules\overlay\vector\Circle.js:91`
```javascript
setStyle(style) {
  delete style['center']
  Util.merge(this._style, style)
  Util.merge(this._delegate.ellipse, style)
  return this
}
```

### 6.3 HTML 元素（DivIcon / Popup）位置偏移
- 检查 `viewer.getOffset()` 是否被正确加到 `windowCoord` 上（用于 Viewer 容器非全屏或页面滚动场景）。
- 检查 CSS 的 `transform: translate3d` 计算逻辑。

### 6.4 内存泄漏
- 确认 `layer.clear()` 或 `overlay.remove()` 时是否清除了 Cesium 原生对象。
- `PrimitiveLayer.clear()` 会 `removeAll()` 并重新创建 Collection，但注意是否保留了外部引用。
- `HtmlLayer` 是否移除了 `postRender` 监听器？（参考 `_renderRemoveCallback` 模式）。

### 6.5 事件不触发
- 确认事件类型常量是否与 `EventType.js` 中定义的一致。
- 检查 `context` 参数是否传递正确，`off` 时 `context` 必须与 `on` 时一致才能移除。

### 6.6 Shader 材质报错
- 确认 `.glsl` 文件是否被 `esbuild-plugin-glsl` 正确内联。
- 确认 `uniforms` 名称与 GLSL 中严格一致。
- Cesium 1.104+ 后 `buildModuleUrl` 被移除，框架已在 `Viewer.js` 中通过 `window.CESIUM_BASE_URL` 兼容。

---

## 七、调试技巧

1. **查看组件状态**：所有组件都有 `state` 属性（`initialized` → `added` → `removed`），可用于断点判断生命周期。
2. **查看代理对象**：通过 `xxx.delegate` 直接访问 Cesium 原生实例，在浏览器控制台验证 Cesium API 行为。
3. **事件监听排查**：`viewer._viewerEvent._cache` 或 `overlay._overlayEvent._cache` 可以查看当前注册了哪些 `Cesium.Event`。
4. **图层缓存排查**：`viewer._layerCache` 按类型存储了所有已添加的 Layer。

---

## 八、总结

该 SDK 的核心封装哲学是 **"代理 + 事件 + 钩子"**：
- 不继承 Cesium 类，而是内部持有 `_delegate`。
- 通过标准化生命周期（`_mountedHook` / `_onAdd` / `_onRemove`）抹平 `Entity`、`Primitive`、`DataSource`、`DOM` 的差异。
- 通过注册表模式（`registerType`）保持可扩展性。

如果你需要新增一个功能组件，**找到最相近的基类（Layer / Overlay / Widget / MaterialProperty），覆盖生命周期钩子，注册类型，导出模块**，即可无缝接入现有体系。
