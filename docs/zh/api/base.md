# 基础 API 🌎

## DC.Viewer

> 3D 场景主要接口，在给定的 DivId 中构建三维场景

### example

```html

<div id="viewer-container"></div>
```

```js
let viewer = new DC.Viewer('viewer-container')
global.viewer = viewer // 添加到全局变量
```

:::warning
如果开发使用的是 Vue 这样的 MVVM 框架，不要将 viewer、layer、overlay 添加到数据模型中。由于 3D
场景中会不停的刷新每一帧，如果将数据添加到数据模型中，长时间的话会导致浏览器的压力增大而奔溃。
:::

### creation

- **_constructor(container,[options])_**

  构造函数

  - 参数
    - `{String | Cesium.Viewer } container`：容器
    - `{Object} options`：属性
  - 返回值 `viewer`

```js
//属性参数（可选）
const config = {
  contextOptions: {
    webgl: {
      alpha: false, // 背景缓冲区是否包含 alpha 通道
      depth: true,  // 开启深度缓冲区（通常必须开启，否则无法正确遮挡）
      stencil: true, // 是否启用模板缓冲。false 可以节省显存和性能
      antialias: true, // 是否启用抗锯齿
      powerPreference: 'high-performance', // 提示浏览器优先用独显或性能更高的 GPU
      premultipliedAlpha: true, // 颜色预乘 alpha，
      preserveDrawingBuffer: false, // 渲染后是否保留缓冲内容。false 性能更好，但不能直接保存截图
      failIfMajorPerformanceCaveat: false, // 避免低性能环境直接报错
    },
    allowTextureFilterAnisotropic: true, // 启用各向异性纹理过滤，提高贴图锐度
  },
  sceneMode: 3, //1: 2.5D，2: 2D，3: 3D
  enableEventPropagation: false, //是否开启鼠标事件冒泡
  enableMouseMovePick: false, // 是否开启鼠标移动拾取功能，开启后当覆盖物较多的情况下，帧率会下降
  enableMouseOver: false, //是否开启鼠标移入事件，需要开启鼠标移动拾取功能
  enableMouseMovePickPosition: false, // 是否在鼠标移动时拾取世界坐标，开启后每次鼠标移动都会回读深度缓冲区
  imageRendering: 'auto', // canvas 的重采样方式，auto：平滑，pixelated：最近邻
  widgets: ['popup', 'tooltip'], // 控件白名单，不传时为全部控件
  tools: ['drawTool', 'editTool'], // 工具白名单，不传时为全部工具
}
```

### properties

- `{Element} container`：场景容器 **_`readonly`_**
- `{Object} delegate`：底层 Cesium 控件实例 **_`readonly`_**
- `{Element} widgetContainer`：场景组件容器 **_`readonly`_**
- `{Element} layerContainer`：场景图层容器 **_`readonly`_**
- `{Object} scene`：场景 **_`readonly`_**，[详细使用说明](http://resource.dvgis.cn/cesium-docs/Scene.html)
- `{Object} camera`：相机 **_`readonly`_**，[详细使用说明](http://resource.dvgis.cn/cesium-docs/Scene.html)
- `{Element} canvas`：canvas 节点 **_`readonly`_**
- `{Object} clock`：时钟，[详细使用说明](http://resource.dvgis.cn/cesium-docs/Clock.html)
- `{Object} viewerEvent`：viewer 事件对象 **_`readonly`_**
- `{Object} dataSources` ：数据资源集合，[详细使用说明](http://resource.dvgis.cn/cesium-docs/DataSourceCollection.html)
- `{Object} imageryLayers`：瓦片集合，[详细使用说明](http://resource.dvgis.cn/cesium-docs/ImageryLayerCollection.html)
- `{Object} entities`：实体集合，[详细使用说明](http://resource.dvgis.cn/cesium-docs/EntityCollection.html)
- `{Object} terrainProvider`：地形服务 **_`readonly`_**
- `{Object} postProcessStages`：后处理阶段集合 **_`readonly`_**
- [`{Popup} popup`](#popup)：气泡窗口 **_`readonly`_**
- [`{ContextMenu} contextMenu`](#contextmenu)：右击弹框 **_`readonly`_**
- [`{Tooltip} tooltip`](#tooltip)：提示框 **_`readonly`_**
- [`{MapSplit} mapSplit`](#mapsplit)：地图分割 **_`readonly`_**
- [`{TilesetSplit} tilesetSplit`](#tilesetsplit)：模型分割 **_`readonly`_**
- [`{SceneSplit} sceneSplit`](#scenesplit)：场景分割 **_`readonly`_**
- [`{Compass} compass`](#compass)：罗盘 **_`readonly`_**
- [`{ZoomController} zoomController`](#zoomcontroller)：罗盘 **_`readonly`_**
- [`{LocationBar} locationBar`](#locationbar)：坐标信息 **_`readonly`_**
- [`{DistanceLegend} distanceLegend`](#distancelegend)：比例尺 **_`readonly`_**
- [`{LoadingMask} loadingMask`](#loadingmask)：加载蒙层 **_`readonly`_**
- `{Position} cameraPosition`：相机位置 **_`readonly`_**
- `{Number} resolution`：分辨率 **_`readonly`_**
- `{Number} zoom`: 当前层级 **_`readonly`_**
- `{Rect} viewBounds`：视野范围 **_`readonly`_**
- `{Boolean} enableEventPropagation`: 是否开启鼠标事件冒泡
- `{Boolean} enableMouseMovePick`: 是否开启鼠标移动拾取功能，开启后当覆盖物较多的情况下，帧率会下降
- `{Boolean} enableMouseOver`: 是否开启鼠标移入事件，需要开启鼠标移动拾取功能

### methods

- **_setOptions(options)_**

  设置属性

  - 参数
    - `{Object} options`：属性对象
      - 返回值 `this`

```js
// 属性参数(属性可选)
const config = {
  shadows: false, // 是否开启阴影
  resolutionScale: 1, // 设置渲染分辨率的缩放比例
  showAtmosphere: true, //是否显示大气层
  showSun: true, //是否显示太阳
  showMoon: true, //是否显示月亮
  enableFxaa: true, //是否开启抗锯齿
  msaaSamples: 1, //msaa抗拒出取样度
  showSunBloom: false, //是否显示太阳泛光
  verticalExaggeration: 1, //地形夸张系数
  verticalExaggerationRelativeHeight: 1, //地形相对高度夸张系数
  tabIndex: 0, //canvas 的 tabIndex
  cameraController: {
    // 相机控制
    enableInputs: true, // 是否开启相机控制输入
    enableRotate: true, // 是否可以旋转
    enableTilt: true, // 是否可以翻转
    enableTranslate: true, // 是否可以平移
    enableZoom: true, // 是否可以缩放
    enableCollisionDetection: true, // 是否支持碰撞检测
    minimumZoomDistance: 1.0, // 最小缩放距离
    maximumZoomDistance: 40489014.0, // 最大缩放距离
  },
  globe: {
    show: true, // 是否显示地球
    showGroundAtmosphere: true, // 显示地面大气
    enableLighting: false, //是否开启灯光，开启后地球会根据当前时间启用灯光
    depthTestAgainstTerrain: false, //是否开启深度测试
    tileCacheSize: 100, // 默认瓦片缓存大小
    preloadSiblings: false, //是否应预加载渲染同级图块
    showSkirts: true, //是否显示瓦片裙边
    baseColor: new DC.Color(0, 0, 0.5, 1), //地球默认底色
    filterColor: new DC.Color(0, 0, 0, 0), //瓦片过滤色,设置后不可逆
    translucency: {
      //地表透明
      enabled: false, // 是否开启地表透明
      backFaceAlpha: 1, // 地球背面透明度
      backFaceAlphaByDistance: null, //根据距离设置地球背面透明度: {near:400,nearValue:0.2,far:800,farValue:1}
      frontFaceAlpha: 1, // 地球正面透明度
      frontFaceAlphaByDistance: null, //根据距离设置地球正面透明度: {near:400,nearValue:0.2,far:800,farValue:1}
    },
  },
  skyBox: {
    sources: {}, // 六个面的贴图
    show: true, //是否显示
    offsetAngle: 0, //旋转角度
  },
}
```

- **_getPerformanceSnapshot()_**

  获取真实生效的性能与画质参数快照

  - 返回值 `Object`，场景未就绪时返回 `{ available: false }`

- **_setRenderQuality(options)_**

  应用渲染质量档位

  - 参数
    - `{Object} options`：档位字段，可传 `resolutionScale`、`useDevicePixelRatio`、`targetFrameRate`、`msaaSamples`、`fxaa`、`sunBloom`、`orderIndependentTranslucency`、`imageRendering`、`groundAtmosphere`、`skyAtmosphere`、`maximumScreenSpaceError`
  - 返回值 `this`

- **_getRenderQuality()_**

  获取渲染质量：期望值与真实生效值

  - 返回值 `Object`，包含 `requested` 与 `effective`

- **_resolvePixelDensity()_**

  解析像素密度，用于图标、贴图纹理密度补偿

  - 返回值 `number`，取值恒 ≥ 1、≤ 4

- **_setPitchRange(min,max)_**

  设置翻转角度

  - 参数
    - `{Number} min`：最小角度
    - `{Number} max`：最大角度
  - 返回值 `this`

- **_changeSceneMode(sceneMode, duration)_**

  改变场景模式

  - 参数
    - `{Number} sceneMode`：场景模式 ，2：2D，3：3D，2.5：2.5D
    - `{Number} duration`：间隔时间
  - 返回值 `this`

- **_changeMouseMode(mouseMode)_**

  改变鼠标使用模式

  - 参数
    - `{Number} mouseMode`：鼠标模式，详情参考：`DC.MouseMode`
  - 返回值 `this`

- **_addBaseLayer(baseLayers,options)_**

  添加地图

  - 参数
    - `{baseLayer|Array<baseLayer>} baseLayers`：地图
    - `{Object} options`：属性
  - 返回值 `this`

```js
//属性参数 (属性可选)
const options = {
  name: '电子地图', //名称
  iconUrl: '../preview.png', //缩略图
  alpha: 1.0,
  nightAlpha: 1.0,
  dayAlpha: 1.0,
  brightness: 1.0,
  contrast: 1.0,
  hue: 1.0,
  saturation: 1.0,
  gamma: 1.0,
}
```

- **_changeBaseLayer(index)_**

  更改地图

  - 参数
    - `{Number} index`：地图索引
  - 返回值 `this`

- **_getImageryLayerInfo(windowPosition)_**

  获取瓦片信息

  - 参数
    - `{Object} windowPosition`：窗口坐标
  - 返回值 `promise`

- **_setTerrain(terrain)_**

  设置地形

  - 参数
    - `{Terrain} terrain`：地形
  - 返回值 `this`

- **_addLayerGroup(layerGroup)_**

  添加图层组

  - 参数
    - `{LayerGroup} layerGroup`：图层组
  - 返回值 `this`

- **_removeLayerGroup(layerGroup)_**

  移除图层组

  - 参数
    - `{LayerGroup} layerGroup`：图层组
  - 返回值 `this`

- **_getLayerGroup(id)_**

  获取图层组

  - 参数
    - `{String} id`：图层组 ID
  - 返回值 `layerGroup`

- **_addLayer(layer)_**

  添加图层

  - 参数
    - `{Layer} layer`：图层
  - 返回值 `this`

- **_removeLayer(layer)_**

  删除图层

  - 参数
    - `{Layer} layer`：图层
  - 返回值 `this`

- **_hasLayer(layer)_**

  检查是否包含图层

  - 参数
    - `{Layer} layer`：图层
  - 返回值 `boolean`

- **_getLayer(id)_**

  获取图层

  - 参数
    - `{String} id`：图层 ID
  - 返回值 `layer`

- **_getLayers()_**

  获取所有图层，不包括地图

  - 返回值 `layer`

- **_eachLayer(method, context)_**

  遍历所有图层

  - 参数
    - `{Function} method`：回调函数
    - `{Object} context`：上下文，默认为 this
  - 返回值 `this`

  ```js
  viewer.eachLayer((layer) => {})
  ```

- **_flyTo(target,duration)_**

  飞向目标

  - 参数
    - `{VectorLayer|Overlay} target` ：目标
    - `{Number} duration`：飞到位置时间，单位：秒
  - 返回值 `this`

- **_zoomTo(target)_**

  缩放到目标

  - 参数
    - `{VectorLayer|Overlay} target` ：目标
  - 返回值 `this`

- **_flyToPosition(position, completeCallback, duration)_**

  飞到具体位置

  - 参数
    - `{Position} position`：位置
    - `{Function} completeCallback`：飞完之后触发的回调
    - `{Number} duration`：飞到位置时间，单位：秒
  - 返回值 `this`

- **_zoomToPosition(position, completeCallback)_**

  缩放到具体位置

  - 参数
    - `{DC.Position} position`：位置
    - `{Function} completeCallback`：缩放完成后触发的回调
  - 返回值 `this`

- **_flyToBounds(bounds,{heading,pitch,roll}, completeCallback, duration)_**

  飞到指定的范围

  - 参数
    - `{String|Array} bounds`：范围，格式:[minX,minY,maxX,maxY]
    - `{Object} hpr`：方位角
    - `{Function} completeCallback`：飞完之后触发的回调
    - `{Number} duration`：飞到位置时间，单位：秒
  - 返回值 `this`

- **_zoomToBounds(bounds,{heading,pitch,roll}, completeCallback)_**

  缩放到指定的范围

  - 参数
    - `{String|Array} bounds`：范围，格式:[minX,minY,maxX,maxY]
    - `{Object} hpr`：方位角
    - `{Function} completeCallback`：缩放完之后触发的回调
  - 返回值 `this`

- **_on(type, callback, context)_**

  事件订阅

  - 参数
    - `{Object} type` ：订阅类型
    - `{Function} callback` ：订阅回调
    - `{Object} context` ：上下文
  - 返回值 `this`

- **_once(type, callback, context)_**

  事件订阅(一次)

  - 参数
    - `{Object} type` ：订阅类型
    - `{Function} callback` ：订阅回调
    - `{Object} context` ：上下文
  - 返回值 `this`

- **_off(type, callback, context)_**

  取消事件订阅

  - 参数
    - `{Object} type` ：订阅类型
    - `{Function} callback` ：订阅回调
    - `{Object} context` ：上下文
  - 返回值 `this`

- **_destroy()_**

  销毁三维场景

  - 返回值 `this`

- **_exportScene(name)_**

  导出场景

  - 参数
    - `{String} name` ：名称，默认为 scene
  - 返回值 `this`

- **_getOffset()_**

  获取场景容器相对视口的偏移

  - 返回值 `Object`，格式`{x:1,y:1}`

- **_resize()_**

  重新调整场景尺寸

  - 返回值 `this`

## Popup

> 气泡窗口

### example

```js
let popup = viewer.popup
popup.setContent('<div></div>')
```

### properties

- `{String} state`：状态 **_`readonly`_**
- `{Object} config`：配置 **_`writeOnly`_**

```js
// 配置（属性可选),配置后会影响全局的popup的显示样式，请慎重。
const config = {
  position: 'center', // popup的位于鼠标的点击位置的方向,有：center（默认），topleft，topright，bottomleft，bottomright
  customClass: 'custom', // 添加自定义的Css 类名到popup中，多个用空格隔开
}
```

### methods

- **_setPosition(position)_**

  设置位置

  - 参数
    - `{Cartesian3} position`：世界坐标
  - 返回值 `this`

- **_setContent(content)_**

  设置内容

  - 参数
    - `{String|Element} content`：内容
  - 返回值 `this`

- **_setWrapper(wrapper)_**

  设置容器

  - 参数
    - `{Element} wrapper`：容器 **_`(一般用于 MVVM 框架的模板)`_**
  - 返回值 `this`

- **_showAt(position, content)_**

  设置内容

  - 参数
    - `{Cartesian3} position`：世界坐标
    - `{String|Element} content`：内容
  - 返回值 `this`

- **_hide()_**

  隐藏气泡窗口

  - 返回值 `this`

## ContextMenu

> 右击菜单

### example

```js
let contextMenu = viewer.contextMenu
contextMenu.enable = true
contextMenu.DEFAULT_MENU = [
  {
    label: '测试',
    callback: (e) => {
    }, // e是一个对象主要包括 windowPosition,position,wgs84Position,surfacePosition,wgs84SurfacePosition,overlay,instanceId
    context: this,
  },
] // 设置默认的右击菜单，会影响全局右击菜单(慎用)。
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**
- `{Object} config`：配置 **_`writeOnly`_**
- `{Array} DEFAULT_MENU`：默认菜单，菜单的回调函数参数为一个对象 **_`writeOnly`_**

## Tooltip

> 提示框

### example

```js
let tooltip = viewer.tooltip
tooltip.enable = true
tooltip.showAt({ x: 100, y: 100 }, '测试')
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

### methods

- **_showAt(position,content)_**

  设置位置

  - 参数
    - `{Cartesian2} position`：屏幕坐标
    - `{String|Element} content`：内容
  - 返回值 `this`

## MapSwitch

> 底图切换

### examples

```js
viewer.mapSwitch.addMap({
  name: '影像底图',
  iconUrl: './images/map.png',
})
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

### methods

- **_addMap([map])_**

  添加地图

  - 参数
    - `{Object} [map]`：地图配置
      - `{String} name`：名称，默认：地图
      - `{String} iconUrl`：图标地址

## HawkeyeMap

> 鹰眼图

### examples

```js
viewer.hawkeyeMap.enable = true
viewer.hawkeyeMap.addBaseLayer(DC.ImageryLayerFactory.createGoogleImageryLayer())
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

### methods

- **_addBaseLayer(baseLayer)_**

  添加地图

  - 参数
    - `{Object|Array} baseLayer`：地图，可以是单个或数组
  - 返回值 `this`

## MapSplit

> 地图分割

### examples

```js
let baseLayer_elc = DC.ImageryLayerFactory.createGoogleImageryLayer()
viewer.mapSplit.enable = true
viewer.mapSplit.addBaseLayer(baseLayer_elc, -1)
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

### methods

- **_addBaseLayer(baseLayer,[splitDirection])_**

  添加地图

  - 参数
    - `{BaseLayer} baseLayer`：地图
    - `{Number} splitDirection`：分割方向，-1：左，0：无，1：右
  - 返回值 `this`

## TilesetSplit

> 模型分割

### examples

```js
let tileset = new DC.Tileset('**/tileset.json')
tileset.setSplitDirection(1)
viewer.tilesetSplit.enable = true
viewer.tilesetSplit.addTileset(tileset)
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

### methods

- **_addTileset(tileset)_**

  添加地图

  - 参数
    - `{Tileset} tileset`：模型
  - 返回值 `this`

## SceneSplit

> 场景分割

### examples

```js
let tileset = new DC.Tileset('**/tileset.json')
tileset.setSplitDirection(1)
viewer.sceneSplit.enable = true
viewer.sceneSplit.addTileset(tileset)
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

### methods

- **_addBaseLayer(baseLayer)_**

  添加地图

  - 参数
    - `{BaseLayer} baseLayer`：地图
  - 返回值 `this`

- **_addTileset(tileset)_**

  添加地图

  - 参数
    - `{Tileset} tileset`：模型
  - 返回值 `this`

## Compass

> 罗盘

### examples

```js
viewer.compass.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

## ZoomController

> 缩放控制

### examples

```js
viewer.zoomController.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

## LocationBar

> 坐标信息

### examples

```js
viewer.locationBar.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

## DistanceLegend

> 比例尺

### examples

```js
viewer.distanceLegend.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

## LoadingMask

> 加载蒙层

### examples

```js
viewer.loadingMask.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{String} state`：状态 **_`readonly`_**

## DC.BaseLayerPicker

> 底图选择器

### example

```js
let baseLayerPicker = new DC.BaseLayerPicker({
  globe: viewer.scene.globe,
})
baseLayerPicker.addImageryLayer(DC.ImageryLayerFactory.createGoogleImageryLayer())
baseLayerPicker.changeImageryLayer(0)
```

### creation

- **_constructor(options)_**

  构造函数

  - 参数
    - `{Object} options`：配置
  - 返回值 `baseLayerPicker`

```js
// options（属性必填）
const options = {
  globe: viewer.scene.globe, // 球体，必填
}
```

### properties

- `{Object} selectedImageryLayer`：当前选中的底图

### methods

- **_addImageryLayer(imageryLayer,[options])_**

  添加底图

  - 参数
    - `{Object|Array} imageryLayer`：底图，可以是单个或数组
    - `{Object} [options]`：配置
  - 返回值 `this`

- **_changeImageryLayer(index)_**

  切换底图

  - 参数
    - `{Number} index`：底图索引
  - 返回值 `this`

## DC.GroundSkyBox

> 近地天空盒，[详情参考](http://resource.dvgis.cn/cesium-docs/SkyBox.html)

### example

```js
scene.skyBox = new DC.GroundSkyBox({
  sources: {
    positiveX: 'skybox_px.png',
    negativeX: 'skybox_nx.png',
    positiveY: 'skybox_py.png',
    negativeY: 'skybox_ny.png',
    positiveZ: 'skybox_pz.png',
    negativeZ: 'skybox_nz.png',
  },
})
```

### creation

- **_constructor(options)_**

  构造函数

  - 参数
    - `{Object} options`：配置
  - 返回值 `skyBox`

```js
//options(属性可选)
const options = {
  sources: {}, // 六个面的贴图
  show: true, //显示
  offsetAngle: 0, //旋转角度
}
```

### properties

- `{Object} sources`：六个面的贴图
- `{Boolean} show`：显示
- `{Number} offsetAngle`：旋转角度

## DC.Position

> 坐标类，用于描述物体在场景中的具体位置，采用右手标准

### example

```js
let position = new DC.Position(120, 22, 102)

let position1 = DC.Position.fromString('120,22,102')

let position2 = DC.Position.fromArray([120, 22, 102])

let position3 = DC.Position.fromObject({ lng: 120, lat: 22, alt: 102 })
```

### creation

- **_constructor(lng,lat,alt,heading,pitch,roll)_**

  构造函数

  - 参数
    - `{Number} lng`：经度
    - `{Number} lat`：纬度
    - `{Number} alt`：高度，单位：米，默认：0
    - `{Number} heading`：偏航角度，可能其他框架作 yaw，表示绕 Z 轴旋转。默认：0
    - `{Number} pitch`：俯仰角度，表示绕 Y 轴旋转。默认：0
    - `{Number} roll`：翻转角度，表示绕 X 轴旋转。默认：0
  - 返回值 `position`

### properties

- `{Number} lng`：经度
- `{Number} lat`：纬度
- `{Number} alt`：高度，单位：米，默认：0
- `{Number} heading`：偏航角度，可能其他框架作 yaw，表示绕 Z 轴旋转。默认：0
- `{Number} pitch`：俯仰角度，表示绕 Y 轴旋转。默认：0
- `{Number} roll`：翻转角度，表示绕 X 轴旋转。默认：0

### methods

- **_serialize()_**

  序列化

  - 返回值 `string`

- **_distance(target)_**

  计算两个坐标之间的距离

  - 参数
    - `{Position} target`：目标坐标
  - 返回值 `number`

- **_clone()_**

  复制一个新的位置

  - 返回值 `position`

- **_copy()_**

  复制一个新的位置

  - 返回值 `position`

- **_toString()_**

  将坐标字符化

  - 返回值 `string`

- **_toArray()_**

  将坐标数组化

  - 返回值 `array`

- **_toObject()_**

  将坐标对象化

  - 返回值 `Object`

### static methods

- **_fromString(str)_**

  将字符化坐标转换为坐标对象

  - 参数
    - `{String} str`：字符化坐标
  - 返回值 `position`

- **_fromArray(array)_**

  将数组化坐标转换为坐标对象

  - 参数
    - `{Array} array`：数组化坐标
  - 返回值 `position`

- **_fromObject(obj)_**

  将 Json 对象坐标转换为坐标对象

  - 参数
    - `{Object} obj`：Json 对象坐标
  - 返回值 `position`

- **_deserialize(valStr)_**

  反序列化

  - 参数
    - `{String} valStr`：序列化的对象
  - 返回值 `position`

## DC.Parse

> 坐标解析工具类,可简写为 DC.P

```js
let position = DC.P.parsePosition('123,32,0')
```

### static methods

- **_parsePosition(position)_**

  解析坐标为 DC.Position

  - 参数
    - `{String|Array|Position} position`：坐标
  - 返回值 `position`

- **_parsePositions(positions)_**

  解析坐标为 Array<DC.Position>

  - 参数
    - `{String|Array} positions`： 坐标
  - 返回值 `array`

- **_parsePointCoordToArray(position)_**

  解析点位坐标为数组

  - 参数
    - `{String|Position} position`：点位坐标
  - 返回值 `array`

- **_parsePolylineCoordToArray(positions)_**

  解析线坐标为二维数组

  - 参数
    - `{String|Array} positions`：线坐标
  - 返回值 `array`

- **_parsePolygonCoordToArray(positions,loop)_**

  解析面坐标为三维数组

  - 参数
    - `{String|Array} positions`：面坐标
    - `{Boolean} loop`：闭合
  - 返回值 `array`

## DC.Transform

> 坐标转换工具类 ,可简写为 DC.T

```js
let cartesian3 = DC.T.transformWGS84ToCartesian(new DC.Position(120, 20))
```

### static methods

- **_transformCartesianToWGS84(cartesian)_**

  世界坐标转换为 84 坐标

  - 参数
    - `{Cartesian3} cartesian`：世界坐标
  - 返回值 `position`

- **_transformCartographicToWGS84(cartographic)_**

  制图坐标转换为 84 坐标

  - 参数
    - `{Cartographic} cartographic`：制图坐标
  - 返回值 `position`

- **_transformWGS84ToCartesian(position,[result])_**

  84 坐标转换为世界坐标

  - 参数
    - `{Position} position`：84 坐标
    - `{Cartesian3} [result]`：可选复用出参
  - 返回值 `cartesian`

- **_transformWGS84ToCartographic(position)_**

  84 坐标转换为制图坐标

  - 参数
    - `{Position} position`：84 坐标
  - 返回值 `cartographic`

- **_transformCartesianArrayToWGS84Array(cartesianArr)_**

  世界坐标数组转 84 坐标数组

  - 参数
    - `{Array<cartesian3>} cartesianArr`：世界坐标数组
  - 返回值 `array`

- **_transformWGS84ArrayToCartesianArray(WGS84Arr,[result])_**

  84 坐标数组转世界坐标数组

  - 参数
    - `{Array<Position>} WGS84Arr`：84 坐标数组
    - `{Array<cartesian3>} [result]`：可选复用数组
  - 返回值 `array`

- **_transformWGS84ToMercator(position)_**

  84 坐标转 Mercator

  - 参数
    - `{Position} position`：84 坐标
  - 返回值 `position`

- **_transformMercatorToWGS84(position)_**

  Mercator 坐标转 84

  - 参数
    - `{Position} position`：Mercator 坐标
  - 返回值 `position`

- **_transformWindowToWGS84(position,viewer)_**

  屏幕坐标转 84

  - 参数
    - `{Object} position`： 屏幕坐标，格式`{x:1,y:1}`
    - `{Viewer} viewer`：3D 场景
  - 返回值 `position`

- **_transformWGS84ToWindow(position,viewer)_**

  84 转屏幕坐标

  - 参数
    - `{Position} position`： 84 坐标
    - `{Viewer} viewer`：3D 场景
  - 返回值 `Object`

- **_generateCirclePositions(center,radius,[segments],[altitude])_**

  生成以指定位置为圆心的 84 圆周坐标

  - 参数
    - `{Position} center`：圆心
    - `{Number} radius`：半径，单位：米
    - `{Number} [segments]`：分段数，默认：360
    - `{Number} [altitude]`：强制所有点的高度，默认取圆心的 alt
  - 返回值 `Array<Position>`

## DC.CoordTransform

> 国内坐标转换工具

```js
let point = DC.CoordTransform.BD09ToGCJ02(120, 20)
```

### static methods

- **_BD09ToGCJ02(lng, lat)_**

  百度坐标系 (BD-09) 的转换 火星坐标系 (GCJ-02)

  - 参数
    - `{Number} lng`：经度
    - `{Number} lat`：纬度
  - 返回值 `[]`

- **_GCJ02ToBD09(lng, lat)_**

  火星坐标系 (GCJ-02) 转换为 百度坐标系 (BD-09)

  - 参数
    - `{Number} lng`：经度
    - `{Number} lat`：纬度
  - 返回值 `[]`

- **_WGS84ToGCJ02(lng, lat)_**

  WGS-84 转换为 火星坐标系 (GCJ-02)

  - 参数
    - `{Number} lng`：经度
    - `{Number} lat`：纬度
  - 返回值 `[]`

- **_GCJ02ToWGS84(lng, lat)_**

  火星坐标系 (GCJ-02) 转换为 WGS-84

  - 参数
    - `{Number} lng`：经度
    - `{Number} lat`：纬度
  - 返回值 `[]`

- **_delta(lng, lat)_**

  计算经纬度偏移量

  - 参数
    - `{Number} lng`：经度
    - `{Number} lat`：纬度
  - 返回值 `[]`

- **_transformLng(lng, lat)_**

  经度偏移量计算函数

  - 参数
    - `{Number} lng`：经度
    - `{Number} lat`：纬度
  - 返回值 `number`

- **_transformLat(lng, lat)_**

  纬度偏移量计算函数

  - 参数
    - `{Number} lng`：经度
    - `{Number} lat`：纬度
  - 返回值 `number`

- **_out_of_china(lng, lat)_**

  判断坐标是否在中国境外

  - 参数
    - `{Number} lng`：经度
    - `{Number} lat`：纬度
  - 返回值 `boolean`

## DC.Math

> 基本函数类

### static methods

- **_area(positions)_**

  面积，单位：平方米

  - 参数
    - `{Array<Position>} positions`： 点位数据
  - 返回值 `number`

- **_bounds(positions , expand)_**

  边界

  - 参数
    - `{Array<Position>} positions`： 点位数据
    - `{Number}} expand`： 扩展比例：0~1
  - 返回值 `object`

- **_midPosition(start , end)_**

  两点之间的中心点

  - 参数
    - `start`： 开始位置
    - `end`： 结束位置
  - 返回值 `position`

- **_midCartesian(start , end)_**

  两点之间的中心点的世界坐标

  - 参数
    - `start`： 开始位置
    - `end`： 结束位置
  - 返回值 `cartesian`

- **_center(positions)_**

  中心点

  - 参数
    - `{Array<Position>} positions`： 点位数据
  - 返回值 `position`

- **_curve(points,[options])_**

  曲线，将折线转换为曲线

  - 参数
    - `{Array} points`： 点位数据
    - `{Object} [options]`： 配置，可传 `count`：曲线的折线段个数，默认：40
  - 返回值 `array`

- **_distance(positions)_**

  距离,单位：米

  - 参数
    - `{Array<Position>} positions`： 点位数据
  - 返回值 `number`

- **_heading(start,end)_**

  偏转角度,单位：度

  - 参数
    - `start`： 开始位置
    - `end`： 结束位置
  - 返回值 `number`

- **_isBetween(value,min,max)_**

  判断数值是否在区间内

  - 参数
    - `{Number} value`： 数值
    - `{Number} min`： 最小值
    - `{Number} max`： 最大值
  - 返回值 `boolean`

- **_parabola(start, end,height,count)_**

  抛物线

  - 参数
    - `start`： 开始位置
    - `end`： 结束位置
    - `{Number} height`： 最高点高度
    - `{Number} count`： 点位数量
  - 返回值 `Array`

> [more](http://resource.dvgis.cn/cesium-docs/Math.html)

## DC.Util

> 工具类

### static methods

- **_uuid(prefix)_**

  生成 uuid

  - 参数
    - `{String} prefix`：前缀，默认为 D
  - 返回值 `string`

- **_merge(dest, ...sources)_**

  属性合并

  - 参数
    - `{Object} dest`：目标对象
    - `{Object|Array} sources`：需要合并的属性
  - 返回值 `object`

- **_splitWords(str)_**

  按空白字符拆分字符串

  - 参数
    - `{String} str`：字符串
  - 返回值 `array`

- **_setOptions(obj,options)_**

  合并属性到对象的 options

  - 参数
    - `{Object} obj`：目标对象
    - `{Object} options`：属性
  - 返回值 `object`

- **_formatNum(num,digits)_**

  保留指定位数的小数，默认：6 位

  - 参数
    - `{Number} num`：数值
    - `{Number} digits`：小数位数，默认：6
  - 返回值 `number`

- **_trim(str)_**

  去除字符串首尾空白

  - 参数
    - `{String} str`：字符串
  - 返回值 `string`

- **_emptyImageUrl()_**

  空图片

- **_checkPosition(position)_**

  校验是否为坐标对象

  - 参数
    - `{Object} position`：坐标对象
  - 返回值 `boolean`

- **_debounce(fn,delay)_**

  防抖

- **_throttle(fn,delay)_**

  节流

- **_dataURLtoBlob(dataUrl)_**

  dataURL 转 Blob

  - 参数
    - `{String} dataUrl`：dataURL 字符串
  - 返回值 `Blob`

- **_isPromise(obj)_**

  判断是否为 Promise 或 thenable

  - 参数
    - `{Object} obj`：对象
  - 返回值 `boolean`

- **_getElapsedSeconds(julianDate)_**

  获取 JulianDate 对应的累计秒数

  - 参数
    - `{Object} julianDate`：JulianDate 对象
  - 返回值 `number`

- **_clampLineWidth(width,[range])_**

  规整折线线宽到安全区间

  - 参数
    - `{Number} width`：线宽（CSS 像素）
    - `{Object} [range]`：目标区间 `{min, max}`，默认 `1 ~ 12`
  - 返回值 `number`

## DC.DomUtil

> Dom 工具类

### static methods

- **_get(id)_**

  获取 dom

  - 参数
    - `{String} id`： 要素 ID
  - 返回值 `Element`

- **_getStyle(el, style)_**

  获取要素的样式值

  - 参数
    - `{Element} el`： 要素
    - `{String} style`： 样式名

- **_create(tagName, className, [container])_**

  创建 dom

  - 参数
    - `{String} tagName`： 标签名
    - `{String} className`： 样式名，多个用空格隔开
    - `{Element} [container]`： 父容器
  - 返回值 `Element`

- **_remove(el)_**

  移除要素

  - 参数
    - `{Element} el`： 要素

- **_empty(el)_**

  清空要素的所有子节点

  - 参数
    - `{Element} el`： 要素

- **_hasClass(el, name)_**

  判断要素是否包含类名

  - 参数
    - `{Element} el`： 要素
    - `{String} className`： 样式名，多个用空格隔开
  - 返回值 `boolean`

- **_addClass(el, name)_**

  添加类名

  - 参数
    - `{Element} el`： 要素
    - `{String} className`： 样式名，多个用空格隔开

- **_removeClass(el, name)_**

  删除类名

  - 参数
    - `{Element} el`： 要素
    - `{String} className`： 样式名，多个用空格隔开

- **_setClass(el, name)_**

  设置要素的类名

  - 参数
    - `{Element} el`： 要素
    - `{String} className`： 样式名，多个用空格隔开

- **_getClass(el)_**

  获取要素的类名

  - 参数
    - `{Element} el`： 要素
  - 返回值 `String`

- **_createSvg(width, height, path, [container])_**

  创建 svg 节点

  - 参数
    - `{Number} width`： 宽度
    - `{Number} height`： 高度
    - `{String} path`： 路径
    - `{Element} [container]`： 父容器
  - 返回值 `svg`

- **_parseDom(domStr, [withWrapper], [className])_**

  字符串转 Dom

  - 参数
    - `{String} domStr`： dom 字符串
    - `{Boolean} withWrapper`：返回是否含有父容器
    - `{String} className`： 类样式名称
  - 返回值 `Element | Nodes`

- **_enterFullscreen(el)_**

  进入全屏

  - 参数
    - `{Element} el`： 要素

- **_exitFullscreen()_**

  退出全屏

- **_createVideo(url, className, [container])_**

  创建视频节点

  - 参数
    - `{String} url`： 视频地址
    - `{String} className`： 样式名，多个用空格隔开
    - `{Element} [container]`： 父容器
  - 返回值 `Element | Nodes`

## DC.IntervalGate

> 采样型间隔闸门，`interval` 毫秒内只放行一次，首次调用（含 `interval <= 0`）必然放行

### example

```js
let intervalGate = new DC.IntervalGate(1000)
if (intervalGate.allow()) {
  // 记录一个轨迹点
}
```

### creation

- **_constructor(intervalMs)_**

  构造函数

  - 参数
    - `{Number} intervalMs`：最小间隔，单位：毫秒，小于等于 0 表示不限流，默认：0
  - 返回值 `intervalGate`

### properties

- `{Number} interval`：最小间隔，单位：毫秒

### methods

- **_allow([now],[interval])_**

  判断本次是否放行

  - 参数
    - `{Number} [now]`：当前时间戳，默认：`Date.now()`
    - `{Number} [interval]`：本次使用的间隔，不传则用构造值
  - 返回值 `boolean`，true：放行并记账，false：丢弃

- **_reset()_**

  复位，清空记账，下次调用立即放行

## DC.TrailingThrottle

> 状态型节流器，同一 `key` 的连续 `push` 在一个节流窗口内只会立即执行第一次，窗口内的后续值被合并为最新值，并在窗口结束时补发一次

### example

```js
let trailingThrottle = new DC.TrailingThrottle(200, (key, position) => {
  // 实际执行更新
})
trailingThrottle.push('drone-1', new DC.Position(120, 20, 100))
```

### creation

- **_constructor(intervalMs,apply)_**

  构造函数

  - 参数
    - `{Number} intervalMs`：节流窗口，单位：毫秒，小于等于 0 表示退化为直通，默认：0
    - `{Function} apply`：实际执行更新的回调，参数为 `(key, payload)`
  - 返回值 `trailingThrottle`

### properties

- `{Number} interval`：节流窗口，单位：毫秒
- `{Number} pendingCount`：待补发数量（诊断用） **_`readonly`_**

### methods

- **_push(key,payload,[now])_**

  推送一次更新

  - 参数
    - `{String} key`：去重键（如实体 id）
    - `{*} payload`：最新值
    - `{Number} [now]`：当前时间戳，默认：`Date.now()`

- **_flush([key])_**

  立即应用挂起值（不等待窗口结束）

  - 参数
    - `{String} [key]`：指定 key，不传则应用全部挂起项

- **_cancel([key])_**

  丢弃指定 key 的挂起值，实体已被移除时使用，避免回调访问已销毁对象

  - 参数
    - `{String} [key]`：指定 key，不传则清空全部

- **_destroy()_**

  销毁，清理定时器与挂起项
