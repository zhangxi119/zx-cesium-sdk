import { Cesium } from '../../libs'
import { getParam } from '../../global-api'
import Parse from '../parse/Parse'
import {
  LayerGroupEventType,
  LayerEventType,
  MouseEvent,
  ViewerEvent,
  SceneEvent,
} from '../event'
import { ViewerOption, CameraOption } from '../option'
import { Util, DomUtil } from '../utils'
import { Transform } from '../transform'
import createWidgets from '../widget'
import createTools from '../tools'
import { BaseLayerPicker } from '../exts'

/**
 * Viewer 默认选项
 *
 * `orderIndependentTranslucency: false` —— **线体抗锯齿的关键默认值**
 *
 * Cesium 该选项默认为 `true`。开启时，所有**半透明图元**会被渲染进
 * `OIT` 自己的一组单采样 framebuffer（`OIT.js` 中四个 `FramebufferManager`
 * 均未传入采样数，颜色纹理也按无采样创建），因此 **`scene.msaaSamples` 对它们完全无效**。
 * 对照 `GlobeDepth` 会把 `numSamples` 传给出参 framebuffer（`GlobeDepth.update` → `_outputFramebuffer.update(..., numSamples, ...)`），
 * 并且 `Scene.resolveFramebuffers()` 在 `!useOIT` 时正是从该 multisample FBO 取样做后处理。
 *
 * 而 Cesium 的折线着色器**没有任何解析式抗锯齿**
 * （`PolylineFS.glsl` 直接输出材质色；`PolylineVS.glsl` 仅做 `width + 0.5` 的半像素扩张），
 * 折线边缘只能依赖 MSAA。于是「OIT 开启」⇒ **虚线/发光/带透明度颜色的折线全部失去抗锯齿**，
 * 这正是线体锯齿的主要来源。
 *
 * 因此 DC 默认关闭 OIT，让半透明图元与不透明图元共用带 MSAA 的 framebuffer。
 * 代价是半透明图元按图元级深度排序混合（不再顺序无关）——
 * 对以线、面、圆、标注为主的 GIS 叠加场景无可见影响；
 * 若场景确实依赖顺序无关的半透明混合（如体积/云层叠加），显式传入
 * `orderIndependentTranslucency: true` 即可恢复 Cesium 行为。
 */
const DEF_OPTS = {
  creditContainer: document.createElement('div'),
  creditViewport: document.createElement('div'),
  baseLayer: false,
  shouldAnimate: true,
  orderIndependentTranslucency: false,
}

/**
 * 画布 `image-rendering` 的 DC 默认值
 *
 * `CesiumWidget` 构造时会无条件执行
 * `canvas.style.imageRendering = FeatureDetection.imageRenderingValue()`，
 * 在 Chrome / Firefox 下该值为 **`pixelated`**（最近邻）。
 * 当渲染分辨率高于 CSS 尺寸时（`resolutionScale > 1`、或
 * `useBrowserRecommendedResolution = false` 走设备像素比），
 * 浏览器便以**最近邻**降采样，使超采样带来的抗锯齿收益被抵消、边缘反而更硬。
 * 置为 `auto` 让浏览器使用平滑重采样。需要还原 Cesium 行为时传 `imageRendering: 'pixelated'`。
 */
const DEF_CANVAS_IMAGE_RENDERING = 'auto'

class Viewer {
  constructor(container, options = {}) {
    __cmdOut && __cmdOut()
    if (
      !container ||
      (typeof container === 'string' && !document.getElementById(container))
    ) {
      throw new Error('Viewer: the container is empty')
    }
    if (container instanceof HTMLElement) {
      throw new Error('Viewer: not support the type container')
    }

    if (typeof container === 'string') {
      const baseUrl = getParam('baseUrl')
      if (baseUrl) {
        // Initialize the CESIUM_BASE_URL (compatible with Cesium 1.104+ where buildModuleUrl was removed)
        window.CESIUM_BASE_URL = baseUrl
        if (Cesium.buildModuleUrl) {
          Cesium.buildModuleUrl.setBaseUrl(baseUrl)
        }
      }
    }

    /**
     * DC 自有选项不应透传给 CesiumWidget（虽无副作用，但保持参数边界清晰）
     */
    const {
      widgets: _widgetOpt,
      tools: _toolOpt,
      imageRendering: imageRenderingOpt,
      ...cesiumOptions
    } = options
    this._delegate =
      typeof container !== 'string'
        ? container
        : new Cesium.CesiumWidget(container, {
            ...DEF_OPTS,
            ...cesiumOptions,
          }) // Initialize the viewer
    this._delegate.canvas.parentNode.className = 'viewer-canvas' //re-name the default class

    /**
     * 覆盖 CesiumWidget 写入的 `image-rendering`（详见 DEF_CANVAS_IMAGE_RENDERING 注释）
     * 仅对字符串入参（由 DC 创建 canvas）生效；外部传入既有 widget 时不动它的画布样式。
     */
    if (typeof container === 'string') {
      const canvas = this._delegate.canvas
      if (canvas && canvas.style) {
        canvas.style.imageRendering =
          imageRenderingOpt === undefined
            ? DEF_CANVAS_IMAGE_RENDERING
            : imageRenderingOpt
      }
    }

    /**
     *  Registers events
     */
    this._mouseEvent = new MouseEvent(this, options) // Register global mouse events
    this._viewerEvent = new ViewerEvent() // Register viewer events
    this._sceneEvent = new SceneEvent(this) // Register scene events

    this._viewerOption = new ViewerOption(this) // Initialize the viewer option
    this._cameraOption = new CameraOption(this) // Initialize the camera option

    /**
     * Registers Container
     *
     */
    this._widgetContainer = DomUtil.create(
      'div',
      'viewer-widgets',
      typeof container === 'string'
        ? document.getElementById(container)
        : this._delegate.container
    ) //Register the widgets container

    this._layerContainer = DomUtil.create(
      'div',
      'viewer-layers',
      typeof container === 'string'
        ? document.getElementById(container)
        : this._delegate.container
    ) //Register the layers container

    this._baseLayerPicker = new BaseLayerPicker({
      globe: this._delegate.scene.globe,
    }) //Initialize the baseLayer picker

    this._layerGroupCache = {}
    this._layerCache = {}
    /**
     * 图层扁平缓存与索引
     *
     * 【性能修正】`getLayers()` 旧实现每次调用都会做「双重 `Object.keys` + 逐层 push」，
     * 分配 1 + N 个数组；而它被 `MouseEvent._getTargetInfo()` 在**每次鼠标事件**上调用
     * （含每一次 mousemove）。现改为增量维护扁平数组与 `Map` 索引，
     * 查找与遍历降为 O(1) / 零额外分配。
     */
    this._layersFlat = []
    this._layerIndex = new Map()

    /**
     * Registers default widgets
     *
     * 支持通过 `options.widgets` 传入白名单以减少启动开销与无用 DOM：
     * `new Viewer('id', { widgets: ['popup', 'tooltip'], tools: ['drawTool', 'editTool'] })`
     * 未传入时保持**全集**（与原行为一致，避免破坏既有使用方）。
     */
    let widgets = createWidgets()
    const widgetWhitelist = Array.isArray(options.widgets)
      ? new Set(options.widgets)
      : null
    Object.keys(widgets).forEach((key) => {
      if (widgetWhitelist && !widgetWhitelist.has(key)) {
        return
      }
      this._use(widgets[key])
    })

    /**
     * Registers default tools
     */
    let tools = createTools()
    const toolWhitelist = Array.isArray(options.tools)
      ? new Set(options.tools)
      : null
    Object.keys(tools).forEach((key) => {
      if (toolWhitelist && !toolWhitelist.has(key)) {
        return
      }
      this._use(tools[key])
    })
  }

  get delegate() {
    return this._delegate
  }

  get container() {
    return this._delegate.container
  }

  get widgetContainer() {
    return this._widgetContainer
  }

  get layerContainer() {
    return this._layerContainer
  }

  get scene() {
    return this._delegate.scene
  }

  get camera() {
    return this._delegate.camera
  }

  get canvas() {
    return this._delegate.scene.canvas
  }

  get dataSources() {
    return this._delegate.dataSources
  }

  get imageryLayers() {
    return this._delegate.imageryLayers
  }

  get terrainProvider() {
    return this._delegate.terrainProvider
  }

  get entities() {
    return this._delegate.entities
  }

  get postProcessStages() {
    return this._delegate.scene.postProcessStages
  }

  get clock() {
    return this._delegate.clock
  }

  get viewerEvent() {
    return this._viewerEvent
  }

  get cameraPosition() {
    let position = Transform.transformCartographicToWGS84(
      this.camera?.positionCartographic
    )
    if (position) {
      position.heading = Cesium.Math.toDegrees(this.camera?.heading ?? 0)
      position.pitch = Cesium.Math.toDegrees(this.camera?.pitch ?? 0)
      position.roll = Cesium.Math.toDegrees(this.camera?.roll ?? 0)
    }
    return position
  }

  get resolution() {
    let width = this.scene.canvas.width
    let height = this.scene.canvas.height
    let min = Transform.transformWindowToWGS84(
      new Cesium.Cartesian2((width / 2) | 0, height - 1),
      this
    )
    let max = Transform.transformWindowToWGS84(
      new Cesium.Cartesian2((1 + width / 2) | 0, height - 1),
      this
    )
    if (!min || !max) {
      return 1
    }
    return Math.abs(min.lng - max.lng)
  }

  get viewBounds() {
    let width = this.scene.canvas.width
    let height = this.scene.canvas.height
    let min = Transform.transformWindowToWGS84(
      new Cesium.Cartesian2(0, height),
      this
    )
    let max = Transform.transformWindowToWGS84(
      new Cesium.Cartesian2(width, 0),
      this
    )
    if (!min || !max) {
      return Cesium.Rectangle.MAX_VALUE
    }
    return Cesium.Rectangle.fromDegrees(min.lng, min.lat, max.lng, max.lat)
  }

  get zoom() {
    let height = this.camera.positionCartographic.height
    let A = 40487.57
    let B = 0.00007096758
    let C = 91610.74
    let D = -40467.74
    return Math.round(D + (A - D) / (1 + Math.pow(height / C, B)))
  }

  set enableEventPropagation(enableEventPropagation) {
    this._mouseEvent.enableEventPropagation = enableEventPropagation
  }

  get enableEventPropagation() {
    return this._mouseEvent.enableEventPropagation
  }

  set enableMouseOver(enableMouseOver) {
    this._mouseEvent.enableMouseOver = enableMouseOver
  }

  get enableMouseOver() {
    return this._mouseEvent.enableMouseOver
  }

  set enableMouseMovePick(enableMouseMovePick) {
    this._mouseEvent.enableMouseMovePick = enableMouseMovePick
  }

  get enableMouseMovePick() {
    return this._mouseEvent.enableMouseMovePick
  }

  /**
   * Adds a plugin
   * @param plugin
   * @returns {Viewer}
   */
  _use(plugin) {
    if (plugin && plugin.install) {
      plugin.install(this)
    }
    return this
  }

  /***
   *
   * @param layerGroup
   * @private
   */
  _addLayerGroup(layerGroup) {
    if (
      layerGroup?.layerGroupEvent &&
      // eslint-disable-next-line no-prototype-builtins
      !Object(this._layerGroupCache).hasOwnProperty(layerGroup.id)
    ) {
      layerGroup.layerGroupEvent.fire(LayerGroupEventType.ADD, this)
      this._layerGroupCache[layerGroup.id] = layerGroup
    }
  }

  /**
   *
   * @param layerGroup
   * @private
   */
  _removeLayerGroup(layerGroup) {
    if (
      layerGroup?.layerGroupEvent &&
      // eslint-disable-next-line no-prototype-builtins
      Object(this._layerGroupCache).hasOwnProperty(layerGroup.id)
    ) {
      layerGroup.layerGroupEvent.fire(LayerGroupEventType.REMOVE, this)
      delete this._layerGroupCache[layerGroup.id]
    }
  }

  /**
   * @param layer
   * @private
   */
  _addLayer(layer) {
    !this._layerCache[layer.type] && (this._layerCache[layer.type] = {})
    // eslint-disable-next-line no-prototype-builtins
    if (!this._layerCache[layer.type].hasOwnProperty(layer.id)) {
      layer.fire(LayerEventType.ADD, this)
      this._layerCache[layer.type][layer.id] = layer
      /**
       * 同步维护扁平缓存与索引
       */
      this._layersFlat.push(layer)
      this._layerIndex.set(layer.id, layer)
    }
  }

  /**
   * @param layer
   * @private
   */
  _removeLayer(layer) {
    // eslint-disable-next-line no-prototype-builtins
    if (this._layerCache[layer.type]?.hasOwnProperty(layer.id)) {
      layer.fire(LayerEventType.REMOVE, this)
      delete this._layerCache[layer.type][layer.id]
      /**
       * 同步维护扁平缓存与索引
       */
      const idx = this._layersFlat.indexOf(layer)
      if (idx >= 0) {
        this._layersFlat.splice(idx, 1)
      }
      if (this._layerIndex.get(layer.id) === layer) {
        this._layerIndex.delete(layer.id)
      }
    }
  }

  /**
   * Sets viewer options
   * @param options
   * @returns {Viewer}
   */
  setOptions(options) {
    this._viewerOption.setOptions(options)
    return this
  }

  /**
   * 读取**真实生效**的性能/画质参数快照
   *
   * 与 `_options`（期望值）不同，本方法直接读取 Cesium 原生对象上的值，
   * 因此可用于验证「渲染档位 / 抗锯齿 / 大气层是否真的生效」；
   * 业务侧的性能诊断面板可直接消费，无需再访问 `viewer.delegate.scene`
   * （DC 不导出 Cesium 命名空间，业务代码直接触碰原生对象既脆弱又重复）。
   *
   * 字段说明：
   * - `resolutionScale` / `useBrowserRecommendedResolution` / `targetFrameRate`：分辨率与帧率策略；
   * - `msaaSamples` / `fxaa` / `sunBloom` / `orderIndependentTranslucency`：决定观感与填充率的抗锯齿链路；
   * - `groundAtmosphere` / `skyAtmosphere` / `maximumScreenSpaceError`：大气层与瓦片精度；
   * - `canvasWidth/Height` / `pixels` / `pixelRatio`：真实绘制缓冲区规模（判断超采样是否被误开）；
   * - `drawCommands` / `primitives` / `globeTiles`：渲染规模，用于定位性能瓶颈。
   *
   * @returns {Object} 快照对象；viewer 未就绪时返回 `{ available: false }`
   */
  getPerformanceSnapshot() {
    const widget = this._delegate
    const scene = widget?.scene
    if (!scene) {
      return { available: false }
    }
    const canvas = scene.canvas
    return {
      available: true,
      // 分辨率与帧率策略
      resolutionScale: widget.resolutionScale,
      useBrowserRecommendedResolution: widget.useBrowserRecommendedResolution,
      targetFrameRate: widget.targetFrameRate,
      // 抗锯齿与大气层（观感 / 填充率的直接决定项）
      msaaSamples: scene.msaaSamples,
      msaaSupported: scene.msaaSupported,
      fxaa: scene.processStages?.fxaa?.enabled ?? scene.postProcessStages?.fxaa?.enabled ?? null,
      sunBloom: scene.sunBloom ?? null,
      orderIndependentTranslucency: scene.orderIndependentTranslucency ?? null,
      imageRendering: canvas?.style?.imageRendering ?? null,
      groundAtmosphere: scene.globe?.showGroundAtmosphere ?? null,
      skyAtmosphere: scene.skyAtmosphere?.show ?? null,
      maximumScreenSpaceError: scene.globe?.maximumScreenSpaceError ?? null,
      // 绘制规模
      pixelRatio: scene.pixelRatio,
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      pixels: (canvas?.width ?? 0) * (canvas?.height ?? 0),
      drawCommands: scene.frameState?.commandList?.length ?? 0,
      primitives: scene.primitives?.length ?? 0,
      globeTiles: scene.globe?.surface?.tilesLoaded?.length ?? null,
    }
  }

  /**
   * 应用渲染质量档位（**直接写 Cesium 原生对象，不经过 `setOptions` 重放**）
   *
   * ## 为什么库层需要它
   * 使用方调优渲染参数时若走 `setOptions`，会被「合并 options 后整体重放」影响；
   * 而直接操作 `viewer.delegate.scene` 又需要触碰 Cesium 原生对象
   * （DC 不导出 Cesium 命名空间，业务代码这样做既脆弱又重复）。
   * 本方法把「档位 → 原生对象」的写入收敛到库层，业务侧只表达**意图**。
   *
   * ## 可传字段（全部可选，只写传入项）
   * - `resolutionScale`：绘制缓冲区缩放（>1 为超采样，填充率按平方增长）；
   * - `useDevicePixelRatio`：是否使用设备像素比（`false` = 按 CSS 像素渲染，性能优先）；
   * - `targetFrameRate`：渲染循环帧率上限（`null`/`undefined` = 不限）；
   * - `msaaSamples`：硬件多重采样数（几何抗锯齿，对折线/虚线边缘真实生效）；
   * - `fxaa`：图像空间抗锯齿（与 MSAA 叠加属重复投入，且会糊化细线）；
   * - `sunBloom`：太阳光晕（每帧多个全屏 pass）；
   * - `orderIndependentTranslucency`：顺序无关半透明（**true 时半透明图元走单采样 FBO，MSAA 失效**）；
   * - `imageRendering`：画布重采样方式（`'auto'` 平滑 / `'pixelated'` 最近邻）；
   * - `groundAtmosphere` / `skyAtmosphere`：地面大气散射 / 天空与太阳月亮；
   * - `maximumScreenSpaceError`：地球瓦片最大屏幕空间误差（越大瓦片越少、画面越糊）。
   *
   * ## 注意事项
   * 1. 本方法**不修改** `_options`，因此后续若有人调用 `setOptions`，仍可能按 DC 选项覆盖同名项；
   *    建议在 `setOptions` **之后**调用本方法，且运行期不要反复调用 `setOptions`；
   * 2. `orderIndependentTranslucency` 属初始化期参数，运行期改动在部分 Cesium 版本上不生效，
   *    应在 `new Viewer({ orderIndependentTranslucency })` 时指定；
   * 3. 写入后触发一次 `requestRender()`，保证档位立即生效。
   *
   * @param {Object} options 档位字段（见上）
   * @returns {Viewer}
   */
  setRenderQuality(options = {}) {
    const widget = this._delegate
    const scene = widget?.scene
    if (!scene) {
      return this
    }
    if (options.resolutionScale != null) {
      widget.resolutionScale = +options.resolutionScale
    }
    if (options.useDevicePixelRatio != null) {
      widget.useBrowserRecommendedResolution = !options.useDevicePixelRatio
    }
    if (options.targetFrameRate !== undefined) {
      widget.targetFrameRate = options.targetFrameRate ?? undefined
    }
    if (options.msaaSamples != null && scene.msaaSupported !== false) {
      scene.msaaSamples = +options.msaaSamples
    }
    if (options.fxaa != null && scene.postProcessStages?.fxaa) {
      scene.postProcessStages.fxaa.enabled = !!options.fxaa
    }
    if (options.sunBloom != null) {
      scene.sunBloom = !!options.sunBloom
    }
    if (options.orderIndependentTranslucency != null) {
      scene.orderIndependentTranslucency = !!options.orderIndependentTranslucency
    }
    if (options.imageRendering != null && scene.canvas) {
      scene.canvas.style.imageRendering = options.imageRendering
    }
    if (options.groundAtmosphere != null && scene.globe) {
      scene.globe.showGroundAtmosphere = !!options.groundAtmosphere
    }
    if (options.skyAtmosphere != null) {
      if (scene.skyAtmosphere) scene.skyAtmosphere.show = !!options.skyAtmosphere
      if (scene.sun) scene.sun.show = !!options.skyAtmosphere
      if (scene.moon) scene.moon.show = !!options.skyAtmosphere
    }
    if (options.maximumScreenSpaceError != null && scene.globe) {
      scene.globe.maximumScreenSpaceError = +options.maximumScreenSpaceError
    }
    /** 记录最近一次应用的档位（供 `getRenderQuality()` 回读「期望值」） */
    this._renderQuality = { ...(this._renderQuality || {}), ...options }
    if (typeof scene.requestRender === 'function') {
      scene.requestRender()
    }
    return this
  }

  /**
   * 读取渲染质量：**期望值 + 真实生效值**
   *
   * `requested` 为最近一次 `setRenderQuality` 传入的字段；
   * `effective` 为原生对象上的真实值（来自 `getPerformanceSnapshot()`）。
   * 二者不一致通常意味着被 `setOptions` 或其它代码覆盖 —— 这是定位"档位没生效"的第一手线索。
   *
   * @returns {{requested: Object, effective: Object}}
   */
  getRenderQuality() {
    return {
      requested: { ...(this._renderQuality || {}) },
      effective: this.getPerformanceSnapshot(),
    }
  }

  /**
   * 解析「像素密度」：一个 CSS 像素应当用多少纹理像素来绘制图标/贴图
   *
   * ## 为什么需要它
   * 当绘制缓冲区小于屏幕物理像素时（例如按 CSS 像素渲染 `useBrowserRecommendedResolution = true`
   * 而屏幕 `devicePixelRatio = 2`），billboard 图标会先被画布放大再上屏 → **发虚**。
   * 把纹理密度补到「屏幕物理像素」口径即可与 DOM 渲染（`<img>`）的锐利度对齐：
   * 纹理像素 = CSS 像素 × 本方法返回值。
   *
   * 计算口径：`window.devicePixelRatio ÷ scene.pixelRatio`（后者为绘制缓冲区与 CSS 尺寸之比）。
   * 因此当绘制缓冲区已是物理像素（如 `useDevicePixelRatio = true`）时结果为 **1**，不重复放大。
   *
   * 配套用法：
   * ```js
   * billboard.size = [82, 69]
   * billboard.pixelDensity = viewer.resolvePixelDensity()   // 密度≤1 时库内自动跳过
   * ```
   *
   * @returns {number} 密度系数，恒 ≥ 1、≤ 4
   */
  resolvePixelDensity() {
    const screenRatio =
      typeof window !== 'undefined' ? Number(window.devicePixelRatio) || 1 : 1
    const scene = this._delegate?.scene
    const canvas = scene?.canvas
    // 绘制缓冲区与 CSS 尺寸之比：1 表示绘制缓冲区就是 CSS 尺寸
    let bufferRatio = Number(scene?.pixelRatio)
    if (!Number.isFinite(bufferRatio) || bufferRatio <= 0) {
      const cssWidth = Number(canvas?.clientWidth) || 0
      const bufferWidth = Number(canvas?.width) || 0
      bufferRatio = cssWidth > 0 && bufferWidth > 0 ? bufferWidth / cssWidth : 1
    }
    const density = screenRatio / (bufferRatio || 1)
    if (!Number.isFinite(density) || density <= 1) return 1
    return Math.min(density, 4)
  }

  /**
   * Sets camera pitch range
   * @param min
   * @param max
   * @returns {Viewer}
   */
  setPitchRange(min = -90, max = -20) {
    this._cameraOption.setPitchRange(min, max)
    return this
  }

  /**
   * Changes Scene Mode，2：2D，2.5：2.5D，3：3D
   * @param sceneMode
   * @param duration
   * @returns {Viewer}
   */
  changeSceneMode(sceneMode, duration = 0) {
    if (sceneMode === 2) {
      this._delegate.scene.morphTo2D(duration)
    } else if (sceneMode === 3) {
      this._delegate.scene.morphTo3D(duration)
    } else if (sceneMode === 2.5) {
      this._delegate.scene.morphToColumbusView(duration)
    }
    return this
  }

  /**
   * Changes Mouse Mode，0：Default，1: Change the tiltEventTypes to CameraEventType.RIGHT_DRAG
   * @param mouseMode
   * @returns {Viewer}
   */
  changeMouseMode(mouseMode) {
    this._cameraOption.changeMouseMode(mouseMode)
    return this
  }

  /**
   *
   * @param terrain
   * @return {Viewer}
   */
  setTerrain(terrain) {
    this._delegate.scene.setTerrain(
      new Cesium.Terrain(
        terrain || Promise.resolve(new Cesium.EllipsoidTerrainProvider())
      )
    )
    return this
  }

  /**
   * Adds the baseLayer .
   * The baseLayer can be a single or an array,
   * and when the baseLayer is an array, the baseLayer will be loaded together
   * @param baseLayer
   * @param options
   * @returns {Viewer}
   */
  addBaseLayer(baseLayer, options = {}) {
    if (!baseLayer) {
      return this
    }
    this._baseLayerPicker.addImageryLayer(baseLayer, options)
    if (!this._baseLayerPicker.selectedImageryLayer) {
      this._baseLayerPicker.changeImageryLayer(0)
    }
    this['mapSwitch'] && this['mapSwitch'].addMap(options)
    return this
  }

  /**
   * Changes the current globe display of the baseLayer
   * @param index
   * @returns {Viewer}
   */
  changeBaseLayer(index) {
    this._baseLayerPicker.changeImageryLayer(index)
    return this
  }

  /**
   *
   * @param windowPosition
   * @returns {Promise}
   */
  getImageryLayerInfo(windowPosition) {
    let ray = this._delegate.camera.getPickRay(windowPosition)
    return this._delegate.imageryLayers.pickImageryLayerFeatures(
      ray,
      this._delegate.scene
    )
  }

  /**
   *
   * @param layerGroup
   * @returns {Viewer}
   */
  addLayerGroup(layerGroup) {
    this._addLayerGroup(layerGroup)
    return this
  }

  /**
   *
   * @param layerGroup
   * @returns {Viewer}
   */
  removeLayerGroup(layerGroup) {
    this._removeLayerGroup(layerGroup)
    return this
  }

  /**
   *
   * @param id
   * @returns {undefined}
   */
  getLayerGroup(id) {
    return this._layerGroupCache[id] || undefined
  }

  /**
   * add a layer
   * @param layer
   * @returns {Viewer}
   */
  addLayer(layer) {
    this._addLayer(layer)
    return this
  }

  /**
   * Removes a layer
   * @param layer
   * @returns {Viewer}
   */
  removeLayer(layer) {
    this._removeLayer(layer)
    return this
  }

  /**
   * Checks to see if the layer is included
   * @param layer
   * @returns {boolean}
   */
  hasLayer(layer) {
    return this._layerIndex.get(layer.id) === layer
  }

  /**
   * Returns a layer by id
   *
   * 【性能修正】由「`getLayers()` 全量数组分配 + `filter` 线性扫描」改为 O(1) 索引查找
   * @param id
   * @returns {*|undefined}
   */
  getLayer(id) {
    return this._layerIndex.get(id)
  }

  /**
   * Returns all layers
   *
   * 【性能修正】返回增量维护的扁平缓存副本。
   * 旧实现每次调用都做「双重 `Object.keys` + 逐层 push」，而本方法位于
   * `MouseEvent._getTargetInfo()` 中，会被**每次鼠标事件**（含每次 mousemove）触发。
   * 返回 `slice()` 副本以保证调用方无法破坏内部缓存。
   * @returns {[]}
   */
  getLayers() {
    return this._layersFlat.slice()
  }

  /**
   * Iterate through each layer and pass it as an argument to the callback function
   * @param method
   * @param context
   * @returns {Viewer}
   */
  eachLayer(method, context) {
    const ctx = context || this
    const layers = this._layersFlat
    for (let i = 0, n = layers.length; i < n; i++) {
      method.call(ctx, layers[i])
    }
    return this
  }

  /**
   * @param target
   * @param duration
   * @returns {Viewer}
   */
  flyTo(target, duration) {
    this._delegate.flyTo(target?.delegate || target, {
      duration,
    })
    return this
  }

  /**
   * @param target
   * @returns {Viewer}
   */
  zoomTo(target) {
    this._delegate.zoomTo(target?.delegate || target)
    return this
  }

  /**
   * Camera fly to a position
   * @param position
   * @param completeCallback
   * @param duration
   * @returns {Viewer}
   */
  flyToPosition(position, completeCallback, duration) {
    position = Parse.parsePosition(position)
    this.camera.flyTo({
      destination: Transform.transformWGS84ToCartesian(position),
      orientation: {
        heading: Cesium.Math.toRadians(position.heading),
        pitch: Cesium.Math.toRadians(position.pitch),
        roll: Cesium.Math.toRadians(position.roll),
      },
      complete: completeCallback,
      duration: duration,
    })
    return this
  }

  /**
   * Camera zoom to a position
   * @param position
   * @param completeCallback
   * @returns {Viewer}
   */
  zoomToPosition(position, completeCallback) {
    this.flyToPosition(position, completeCallback, 0)
    return this
  }

  /**
   * Camera fly to bounds
   * @param bounds
   * @param heading
   * @param pitch
   * @param roll
   * @param completeCallback
   * @param duration
   * @return {Viewer}
   */
  flyToBounds(
    bounds,
    { heading = 0, pitch = 0, roll = 0 },
    completeCallback,
    duration
  ) {
    if (!bounds) {
      return this
    }
    if (!Array.isArray(bounds)) {
      bounds = bounds.split(',')
    }
    this.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        bounds[0],
        bounds[1],
        bounds[2],
        bounds[3]
      ),
      orientation: {
        heading: Cesium.Math.toRadians(heading),
        pitch: Cesium.Math.toRadians(pitch),
        roll: Cesium.Math.toRadians(roll),
      },
      complete: completeCallback,
      duration: duration,
    })
    return this
  }

  /**
   *
   * @param bounds
   * @param heading
   * @param pitch
   * @param roll
   * @param completeCallback
   * @return {Viewer}
   */
  zoomToBounds(bounds, { heading = 0, pitch = 0, roll = 0 }, completeCallback) {
    this.flyToBounds(bounds, { heading, pitch, roll }, completeCallback)
    return this
  }

  /**
   *
   * @param type
   * @param callback
   * @param context
   * @returns {Viewer}
   */
  on(type, callback, context) {
    this._viewerEvent.on(type, callback, context || this)
    this._sceneEvent.on(type, callback, context || this)
    return this
  }

  /**
   *
   * @param type
   * @param callback
   * @param context
   * @returns {Viewer}
   */
  once(type, callback, context) {
    this._viewerEvent.once(type, callback, context || this)
    return this
  }

  /**
   *
   * @param type
   * @param callback
   * @param context
   * @returns {Viewer}
   */
  off(type, callback, context) {
    this._viewerEvent.off(type, callback, context || this)
    this._sceneEvent.off(type, callback, context || this)
    return this
  }

  /**
   * Destroys the viewer.
   */
  destroy() {
    /**
     * 直接遍历扁平缓存副本（`_removeLayer` 会就地修改 `_layersFlat`，故先复制）
     */
    const layers = this._layersFlat.slice()
    for (let i = 0; i < layers.length; i++) {
      this._removeLayer(layers[i])
    }
    this._delegate.destroy()
    this._delegate = undefined
    this._baseLayerPicker = undefined
    this._layerCache = {}
    this._layersFlat = []
    this._layerIndex.clear()
    this._layerGroupCache = {}
    this._widgetContainer.parentNode.removeChild(this._widgetContainer)
    this._widgetContainer = undefined
    this._layerContainer.parentNode.removeChild(this._layerContainer)
    this._layerContainer = undefined
    return this
  }

  /**
   * Export scene to image
   * @param name
   * @returns {Viewer}
   */
  exportScene(name) {
    this.scene.render()
    let canvas = this.canvas
    let image = canvas
      .toDataURL('image/png')
      .replace('image/png', 'image/octet-stream')
    let link = document.createElement('a')
    let blob = Util.dataURLtoBlob(image)
    let objUrl = URL.createObjectURL(blob)
    link.download = `${name || 'scene'}.png`
    link.href = objUrl
    link.click()
    return this
  }

  /**
   *
   * @returns
   */
  getOffset() {
    const offset = { x: 0, y: 0 }
    const container = this._delegate?.container
    if (container) {
      if (container.getBoundingClientRect) {
        const rect = container.getBoundingClientRect()
        offset.x = rect.left
        offset.y = rect.top
      } else {
        offset.x = container.offsetLeft
        offset.y = container.offsetTop
      }
    }
    return offset
  }

  /**
   *
   * @returns {Viewer}
   */
  resize() {
    this._delegate.resize()
    return this
  }
}

export default Viewer
