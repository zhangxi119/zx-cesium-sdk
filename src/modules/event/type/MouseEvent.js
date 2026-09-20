import { Cesium } from '../../../libs'
import { MouseEventType } from '../EventType'
import Event from '../Event'

/**
 * 鼠标事件基类
 *
 * 性能说明（本文件是"每次鼠标移动"的热路径，任何逐事件开销都会被放大 60 倍/秒）：
 *  1. `_adjustPosition` 不再每次调用 `getBoundingClientRect()`（强制同步布局），改为按尺寸变化失效的缓存；
 *  2. `_getMouseInfo` 只计算一次调整后坐标（旧实现重复计算两次，即两次强制布局）；
 *  3. `scene.pickPosition()`（GPU 深度回读，阻塞渲染流水线）改为**按需**开启
 *     （`enableMouseMovePickPosition`，默认关闭）；
 *  4. `_raiseEvent` 增加**订阅者前置短路**，无订阅者时完全不构造 targetInfo（不再 `getLayers()` + 线性扫描）。
 */
class MouseEvent extends Event {
  constructor(viewer, options = {}) {
    super(MouseEventType)
    this._viewer = viewer
    this._selected = undefined
    this._enableEventPropagation = options.enableEventPropagation
    this._enableMouseOver = options.enableMouseOver
    this._enableMouseMovePick = options.enableMouseMovePick
    /**
     * 是否在鼠标移动时执行 `scene.pickPosition()`（GPU 深度回读）。
     * 默认**关闭**：该调用内部为 `gl.readPixels`，会阻塞等待 GPU 完成当前绘制，
     * 每次鼠标移动一次，严重破坏渲染流水线的并行性。
     * 关闭后 `position` / `wgs84Position` 为 `undefined`，
     * 但 `surfacePosition` / `wgs84SurfacePosition` 仍然提供（纯 CPU 椭球拾取）。
     */
    this._enableMouseMovePickPosition =
      options.enableMouseMovePickPosition ?? false
    /** 坐标调整缓存（canvas 尺寸变化时失效） */
    this._adjustCache = undefined
    this._registerEvent()
    this._addDefaultEvent()
  }

  set enableEventPropagation(enableEventPropagation) {
    this._enableEventPropagation = enableEventPropagation
  }

  get enableEventPropagation() {
    return this._enableEventPropagation
  }

  set enableMouseOver(enableMouseOver) {
    this._enableMouseOver = enableMouseOver
  }

  get enableMouseOver() {
    return this._enableMouseOver
  }

  set enableMouseMovePick(enableMouseMovePick) {
    this._enableMouseMovePick = enableMouseMovePick
  }

  get enableMouseMovePick() {
    return this._enableMouseMovePick
  }

  /**
   * 是否在鼠标移动时执行 GPU 深度拾取（`scene.pickPosition`）
   *
   * 默认 `false`。开启后 `wgs84Position` 有值但每次鼠标移动都会阻塞 GPU；
   * 关闭时 `position` / `wgs84Position` 为 `undefined`，
   * 请改用 `wgs84SurfacePosition`（纯 CPU 椭球拾取，代价极低）。
   */
  set enableMouseMovePickPosition(enableMouseMovePickPosition) {
    this._enableMouseMovePickPosition = !!enableMouseMovePickPosition
  }

  get enableMouseMovePickPosition() {
    return this._enableMouseMovePickPosition
  }

  /**
   * 判断 viewer 层是否订阅了指定事件
   * @param {*} type
   * @returns {boolean}
   * @private
   */
  _hasViewerListener(type) {
    const event = this._viewer?.viewerEvent?.getEvent(type)
    return !!event && event.numberOfListeners > 0
  }

  /**
   * 注册 Cesium 输入事件
   *
   * 说明：仅为 DC 实际派发的事件类型注册动作。
   * 旧实现遍历 `Cesium.ScreenSpaceEventType` 的**全部**成员
   * （含 MIDDLE_* / PINCH_* 等 DC 从不派发的类型），
   * 每个类型都会创建一个 `Cesium.Event` 与一个闭包；
   * 现按 `MouseEventType` 的取值集合注册，数量更少且语义更明确。
   * @private
   */
  _registerEvent() {
    const handler = new Cesium.ScreenSpaceEventHandler(this._viewer.canvas)
    /**
     * 取 MouseEventType 中所有**数值**型成员（即真正的 Cesium 事件类型），
     * 排除 MOUSE_OVER / MOUSE_OUT 这类 DC 自有的字符串常量
     */
    Object.keys(MouseEventType).forEach((key) => {
      const type = MouseEventType[key]
      if (typeof type !== 'number' || this._cache[type]) {
        return
      }
      this._cache[type] = new Cesium.Event()
      handler.setInputAction((movement) => {
        this._cache[type].raiseEvent(movement)
      }, type)
    })
  }

  /**
   * add default event for the viewer
   * @private
   */
  _addDefaultEvent() {
    this.on(this._types.LEFT_DOWN, this._leftDownHandler, this)
    this.on(this._types.LEFT_UP, this._leftUpHandler, this)
    this.on(this._types.CLICK, this._clickHandler, this)
    this.on(this._types.DB_CLICK, this._dbClickHandler, this)
    this.on(this._types.RIGHT_DOWN, this._rightDownHandler, this)
    this.on(this._types.RIGHT_UP, this._rightUpHandler, this)
    this.on(this._types.RIGHT_CLICK, this._rightClickHandler, this)
    this.on(this._types.MOUSE_MOVE, this._mouseMoveHandler, this)
    this.on(this._types.WHEEL, this._mouseWheelHandler, this)
  }

  /**
   * 调整位置，将视图位置从像素坐标转换为归一化设备独立像素坐标。
   * 这个函数用于处理不同设备上因DPI不同导致的显示问题，确保在高DPI设备上也能正确显示。
   *
   * 【性能修正】`getBoundingClientRect()` 与 `offsetWidth/offsetHeight` 都是**布局读取**：
   * 若期间发生过任何 DOM 写入，浏览器必须**强制同步重排**才能给出准确值。
   * 本方法在鼠标移动时约 60 次/秒被调用，因此改为按 canvas 尺寸缓存的实现
   * —— 尺寸不变时零布局读取。
   *
   * @param {Object} position - 像素坐标，包含x和y属性。
   * @returns {Cesium.Cartesian2} - 归一化设备独立像素坐标。
   */
  _adjustPosition(position) {
    const canvas = this._viewer.canvas
    const width = canvas.offsetWidth
    const height = canvas.offsetHeight
    let cache = this._adjustCache
    if (!cache || cache.width !== width || cache.height !== height) {
      const rect = canvas.getBoundingClientRect()
      cache = this._adjustCache = {
        width,
        height,
        scaleX: rect.width ? width / rect.width : 1,
        scaleY: rect.height ? height / rect.height : 1,
      }
    }
    return new Cesium.Cartesian2(
      position.x * cache.scaleX,
      position.y * cache.scaleY
    )
  }

  /**
   * 获取鼠标位置信息
   *
   * 【性能修正】`scene.pickPosition()` 改为**按需**执行（见 `enableMouseMovePickPosition`）。
   * 旧实现对每次鼠标移动都调用它，而它内部是 `gl.readPixels`
   * —— 一个**GPU→CPU 同步点**，会阻塞到 GPU 完成当前所有绘制为止。
   * 关闭后仍提供纯 CPU 的椭球/地形求交结果（`surfacePosition` / `wgs84SurfacePosition`）。
   * @param {*} windowPosition
   * @returns
   */
  _getMousePosition(windowPosition) {
    let scene = this._viewer.scene
    let position = undefined
    let wgs84Position = undefined
    let surfacePosition = undefined
    let wgs84SurfacePosition = undefined

    const cartesianToWGS84 = (cartesian) => {
      if (!cartesian) {
        return undefined
      }
      let c = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian)
      if (!c) {
        return undefined
      }
      return {
        lng: Cesium.Math.toDegrees(c.longitude),
        lat: Cesium.Math.toDegrees(c.latitude),
        alt: c.height,
      }
    }

    /**
     * 仅在显式开启时执行 GPU 深度回读
     */
    if (this._enableMouseMovePickPosition && scene.pickPositionSupported) {
      position = scene.pickPosition(windowPosition)
      wgs84Position = cartesianToWGS84(position)
    }

    if (
      scene.mode === Cesium.SceneMode.SCENE3D &&
      !(this._viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider)
    ) {
      let ray = scene.camera.getPickRay(windowPosition)
      surfacePosition = scene.globe.pick(ray, scene)
    } else {
      surfacePosition = scene.camera.pickEllipsoid(
        windowPosition,
        Cesium.Ellipsoid.WGS84
      )
    }
    wgs84SurfacePosition = cartesianToWGS84(surfacePosition)
    return {
      windowPosition,
      position,
      wgs84Position,
      surfacePosition,
      wgs84SurfacePosition,
    }
  }

  /**
   * 获取鼠标事件的完整信息
   *
   * 【性能修正】旧实现把 `_adjustPosition(position)` 调用了**两次**
   * （一次给 `_getMousePosition`、一次给 `scene.pick`），即两次强制布局；
   * 现只计算一次并复用。
   * @param position
   * @private
   */
  _getMouseInfo(position) {
    const adjusted = this._adjustPosition(position)
    return {
      ...this._getMousePosition(adjusted),
      target: this._viewer.scene.pick(adjusted),
    }
  }

  /**
   * Gets the drill pick overlays for the mouse event
   * @param windowPosition
   * @param exclude
   * @returns {*[]}
   * @private
   */
  _getDrillInfos(windowPosition, exclude) {
    let drillInfos = []
    const scene = this._viewer.scene
    const targets = scene.drillPick(windowPosition) || []
    for (const target of targets) {
      const targetInfo = this._getTargetInfo(target)
      if (targetInfo?.overlay?.overlayId !== exclude.overlayId) {
        drillInfos.push(targetInfo)
      }
    }
    return drillInfos
  }

  /**
   *
   * @param target
   * @returns {{overlayId: (function(): Overlay._id)|*, layerId: (function(): Layer._id)|string|*, object: undefined, feature: undefined}}
   * @private
   */
  _getTargetObject(target) {
    let feature = null
    let object = null
    if (target?.id instanceof Cesium.Entity) {
      object = target.id
    } else if (target instanceof Cesium.Cesium3DTileFeature) {
      object = target.tileset
      feature = target
    } else if (target?.primitive instanceof Cesium.Cesium3DTileset) {
      object = target.primitive
    } else if (target?.primitive) {
      object = target.primitive
    }
    return {
      overlayId: object?.overlayId,
      layerId: object?.layerId,
      object,
      feature,
    }
  }

  /**
   * Returns the target information for the mouse event
   * @param target
   * @returns {{instanceId: *, overlay: undefined, feature: undefined, layer: undefined}}
   * @private
   */
  _getTargetInfo(target) {
    const { overlayId, layerId, feature } = this._getTargetObject(target)
    const layers = this._viewer.getLayers()
    const layer = layerId
      ? layers.find((item) => item.layerId === layerId)
      : null
    const overlay =
      overlayId && layer?.getOverlay ? layer.getOverlay(overlayId) : null
    if (overlay && feature?.getPropertyNames) {
      let propertyNames = feature.getPropertyNames() || []
      for (const propertyName of propertyNames) {
        overlay.attr[propertyName] = feature.getProperty(propertyName)
      }
    }
    return {
      layer: layer,
      overlay: overlay,
      feature: feature,
      instanceId: target?.instanceId,
    }
  }

  /**
   * 派发订阅事件
   *
   * 【性能修正】新增**前置短路**：
   * 当本次事件没有拾取到任何目标（`mouseInfo.target` 为空，即鼠标位于空白地球/天空上，
   * 这是鼠标移动时的绝大多数情形）时，`overlay` 与 `layer` 必然都为空，
   * 唯一可能被触发的只有 viewer 事件。因此只要 viewer 也没有该事件的订阅者，
   * 就可以直接返回 —— 跳过 `_getTargetInfo()`（其旧实现会 `getLayers()` 分配数组 + 线性查找）。
   * @param type
   * @param mouseInfo
   * @private
   */
  _raiseEvent(type, mouseInfo = {}) {
    if (!mouseInfo.target && !this._hasViewerListener(type)) {
      return
    }
    const targetInfo = this._getTargetInfo(mouseInfo.target) || {}
    const { overlay, layer } = targetInfo

    const doRaise = (eventHost, payload) => {
      if (!eventHost || typeof eventHost.getEvent !== 'function') return false
      const event = eventHost.getEvent(type)
      if (!event || event.numberOfListeners <= 0) return false
      event.raiseEvent(payload)
      return true
    }

    // raise event for overlay
    const eventParams = { ...targetInfo, ...mouseInfo }
    let handled = doRaise(overlay?.overlayEvent, eventParams)
    if (overlay?.allowDrillPicking) {
      const drillInfos =
        this._getDrillInfos(mouseInfo.windowPosition, overlay) || []
      for (const drillInfo of drillInfos) {
        const dOverlay = drillInfo?.overlay
        const dLayer = drillInfo?.layer
        const drillEventParams = { ...drillInfo, ...mouseInfo }
        let dHandled = doRaise(dOverlay.overlayEvent, drillEventParams)
        if (!dHandled) {
          doRaise(dLayer?.layerEvent, drillEventParams)
        }
      }
    }

    // raise event for layer
    if (!handled || this._enableEventPropagation) {
      handled = doRaise(layer?.layerEvent, eventParams)
    }

    // raise event for viewer
    if (!handled || this._enableEventPropagation) {
      doRaise(this._viewer?.viewerEvent, eventParams)
    }
  }

  /**
   * Default click event handler
   * @param movement
   * @returns {boolean}
   * @private
   */
  _clickHandler(movement) {
    if (!movement?.position) {
      return false
    }
    this._raiseEvent(
      MouseEventType.CLICK,
      this._getMouseInfo(movement.position)
    )
  }

  /**
   * Default dbClick event handler
   * @param movement
   * @returns {boolean}
   * @private
   */
  _dbClickHandler(movement) {
    if (!movement?.position) {
      return false
    }
    this._raiseEvent(
      MouseEventType.DB_CLICK,
      this._getMouseInfo(movement.position)
    )
  }

  /**
   * Default rightClick event handler
   * @param movement
   * @returns {boolean}
   * @private
   */
  _rightClickHandler(movement) {
    if (!movement?.position) {
      return false
    }
    this._raiseEvent(
      MouseEventType.RIGHT_CLICK,
      this._getMouseInfo(movement.position)
    )
  }

  /**
   * Default mousemove event handler
   * @param movement
   * @returns {boolean}
   * @private
   */
  _mouseMoveHandler(movement) {
    if (!movement?.endPosition) {
      return false
    }
    if (this._enableMouseMovePick) {
      let mouseInfo = this._getMouseInfo(movement.endPosition)
      this._viewer.canvas.style.cursor = mouseInfo.target
        ? 'pointer'
        : 'default'
      this._raiseEvent(MouseEventType.MOUSE_MOVE, mouseInfo)
      if (this._enableMouseOver) {
        if (
          !this._selected ||
          this._getTargetObject(this._selected.target).overlayId !==
            this._getTargetObject(mouseInfo.target).overlayId
        ) {
          // add event for overlay
          this._raiseEvent(MouseEventType.MOUSE_OUT, this._selected)
          this._raiseEvent(MouseEventType.MOUSE_OVER, mouseInfo)
          this._selected = mouseInfo
        }
      }
    } else {
      this._raiseEvent(
        MouseEventType.MOUSE_MOVE,
        this._getMousePosition(this._adjustPosition(movement.endPosition))
      )
    }
  }

  /**
   * Default mouse left down event handler
   * @param movement
   * @private
   */
  _leftDownHandler(movement) {
    if (!movement?.position) {
      return false
    }
    this._raiseEvent(
      MouseEventType.LEFT_DOWN,
      this._getMouseInfo(movement.position)
    )
  }

  /**
   * Default mouse left up event handler
   * @param movement
   * @private
   */
  _leftUpHandler(movement) {
    if (!movement?.position) {
      return false
    }
    this._raiseEvent(
      MouseEventType.LEFT_UP,
      this._getMouseInfo(movement.position)
    )
  }

  /**
   * Default mouse right down event handler
   * @param movement
   * @private
   */
  _rightDownHandler(movement) {
    if (!movement?.position) {
      return false
    }
    this._raiseEvent(
      MouseEventType.RIGHT_DOWN,
      this._getMouseInfo(movement.position)
    )
  }

  /**
   * Default mouse right up event handler
   * @param movement
   * @private
   */
  _rightUpHandler(movement) {
    if (!movement?.position) {
      return false
    }
    this._raiseEvent(
      MouseEventType.RIGHT_UP,
      this._getMouseInfo(movement.position)
    )
  }

  /**
   * Default mouse wheel event handler
   * @param movement
   * @private
   */
  _mouseWheelHandler(movement) {
    this._raiseEvent(MouseEventType.WHEEL, { movement })
  }
}

export default MouseEvent
