/**
 * @Author : zhangxi119
 * @Last Modified By : zhangxi119
 * @Last Modified Time : 2026-07-27 14:44:00
 */
import { Cesium } from '../../../libs'
import Overlay from '../Overlay'
import State from '../../state/State'
import Parse from '../../parse/Parse'
import { Transform } from '../../transform'
import { Util } from '../../utils'
import { MouseEventType } from '../../event'

class TrajectoryLine extends Overlay {
  /**
   * 构造函数
   * @param positions {Position[]|string} 轨迹坐标点数组，支持 Position 数组或字符串格式
   * @param options {Object} 可选配置项
   */
  constructor(positions, options = {}) {
    super()
    this._positions = Parse.parsePositions(positions)
    this._options = options
    this._pointEntities = [] // 分点 billboard entity 列表
    this._glowImageCache = {} // 发光点图片缓存（按颜色缓存）
    this._positionsDirty = true // 坐标脏标记，用于 Cartesian3 缓存
    this._cachedCartesianPositions = null // Cartesian3 坐标缓存数组
    this._tooltipContent = options.tooltipContent || null // tooltip 内容回调
    this._tooltipTrigger = options.tooltipTrigger || 'both' // tooltip 触发方式
    this._showPoints = options.showPoints !== false // 是否显示分点
    this._lineStyle = {
      color: Cesium.Color.fromCssColorString('#00FFFF'),
      width: 4,
      glowPower: 0.25,
      glow: true,
      clampToGround: false,
      dash: false,
      dashLength: 16,
      dashPattern: 255,
      ...(options.lineStyle || {}),
    }
    this._pointStyle = {
      pointSize: 24,
      pointColor: Cesium.Color.fromCssColorString('#FFFF00'),
      pointGradient: true,
      pointGradientDirection: 'ascend',
      pointGlow: true,
      ...(options.pointStyle || {}),
    }

    this._delegate = new Cesium.Entity({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          this._ensureCartesianCache()
          return this._cachedCartesianPositions
        }, false),
        width: this._lineStyle.width,
        material: this._createLineMaterial(),
        clampToGround: this._lineStyle.clampToGround,
      },
    })

    this._state = State.INITIALIZED
  }

  /** 覆盖物类型 */
  get type() {
    return Overlay.getOverlayType('trajectory_line')
  }

  /**
   * 全量替换坐标数组，内部做 diff：新增的点位追加 entity，减少的点位移除 entity
   * 数量不变时仅更新坐标值（通过 CallbackProperty 自动响应）
   * @param positions {Position[]|string} 新坐标数组
   */
  set positions(positions) {
    let newPositions = Parse.parsePositions(positions)
    let oldLen = this._positions.length
    let newLen = newPositions.length
    this._positions = newPositions
    this._markPositionsDirty()
    if (!this._showPoints || !this._layer) {
      return
    }
    if (newLen > oldLen) {
      let glowImage = this._createGlowImage(this._pointStyle.pointColor)
      for (let i = oldLen; i < newLen; i++) {
        this._addPointEntity(i, glowImage)
      }
    } else if (newLen < oldLen) {
      for (let i = oldLen - 1; i >= newLen; i--) {
        this._removePointEntity(i)
      }
    }
  }

  /** 获取当前坐标数组 */
  get positions() {
    return this._positions
  }

  /**
   * 在末尾或指定索引处添加一个坐标点，自动追加对应的 billboard entity
   * @param position {Position|string} 要添加的坐标点
   * @param index {number?} 插入位置索引，省略或 >= 数组长度时追加到末尾
   * @returns {TrajectoryLine}
   */
  addPosition(position, index) {
    let parsedPos = Parse.parsePosition(position)
    if (index === undefined || index >= this._positions.length) {
      this._positions.push(parsedPos)
      this._markPositionsDirty()
      if (this._showPoints && this._layer) {
        let glowImage = this._createGlowImage(this._pointStyle.pointColor)
        this._addPointEntity(this._positions.length - 1, glowImage)
      }
    } else {
      this._positions.splice(index, 0, parsedPos)
      this._markPositionsDirty()
      if (this._showPoints && this._layer) {
        let glowImage = this._createGlowImage(this._pointStyle.pointColor)
        this._addPointEntity(index, glowImage)
      }
    }
    return this
  }

  /**
   * 移除指定索引的坐标点及对应 entity
   * @param index {number} 要移除的坐标点索引
   * @returns {TrajectoryLine}
   */
  removePositionAt(index) {
    if (index < 0 || index >= this._positions.length) {
      return this
    }
    this._positions.splice(index, 1)
    this._markPositionsDirty()
    if (this._pointEntities.length > index) {
      this._removePointEntity(index)
    }
    return this
  }

  /**
   * 按坐标值查找并移除坐标点（经纬度及高度均匹配时移除）
   * @param position {Position|string} 要移除的坐标点
   * @returns {TrajectoryLine}
   */
  removePosition(position) {
    let parsedPos = Parse.parsePosition(position)
    for (let i = 0; i < this._positions.length; i++) {
      let p = this._positions[i]
      if (
        Math.abs(p.lng - parsedPos.lng) < 1e-10 &&
        Math.abs(p.lat - parsedPos.lat) < 1e-10 &&
        Math.abs(p.alt - parsedPos.alt) < 1e-10
      ) {
        return this.removePositionAt(i)
      }
    }
    return this
  }

  /**
   * 根据虚线配置创建线材质
   * @returns {MaterialProperty}
   * @private
   */
  _createLineMaterial() {
    if (this._lineStyle.material) {
      return this._lineStyle.material
    }
    if (this._lineStyle.dash) {
      return new Cesium.PolylineDashMaterialProperty({
        color: this._lineStyle.color,
        gapColor: Cesium.Color.TRANSPARENT,
        dashLength: this._lineStyle.dashLength,
        dashPattern: this._lineStyle.dashPattern,
      })
    }
    // glow: false 时使用 PolylineOutlineMaterialProperty 纯色材质（无光晕）
    // ColorMaterialProperty 不适用于 PolylineGraphics 渲染管线，会导致线不可见
    if (this._lineStyle.glow === false) {
      return new Cesium.PolylineOutlineMaterialProperty({
        color: this._lineStyle.color,
        outlineColor: this._lineStyle.color,
        outlineWidth: 0,
      })
    }
    return new Cesium.PolylineGlowMaterialProperty({
      color: this._lineStyle.color,
      glowPower: this._lineStyle.glowPower,
    })
  }

  /**
   * 生成点位图片（data url），按颜色+发光模式缓存
   * pointGlow=true → 径向渐变发光点
   * pointGlow=false → 实心圆点（不发光）
   * @param color {Cesium.Color} 点颜色
   * @returns {string} data url
   * @private
   */
  _createGlowImage(color) {
    let cssColor = color.toCssColorString()
    let cacheKey =
      cssColor + '_' + (this._pointStyle.pointGlow ? 'glow' : 'solid')
    if (this._glowImageCache[cacheKey]) {
      return this._glowImageCache[cacheKey]
    }
    let size = 128
    let canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    let ctx = canvas.getContext('2d')
    let center = size / 2
    let r = Math.round(color.red * 255)
    let g = Math.round(color.green * 255)
    let b = Math.round(color.blue * 255)
    if (this._pointStyle.pointGlow) {
      // 发光模式：径向渐变
      let gradient = ctx.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center
      )
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`)
      gradient.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, 0.85)`)
      gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.35)`)
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    } else {
      // 不发光模式：实心圆
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`
      ctx.beginPath()
      ctx.arc(center, center, center, 0, Math.PI * 2)
      ctx.fill()
    }
    let dataUrl = canvas.toDataURL()
    this._glowImageCache[cacheKey] = dataUrl
    return dataUrl
  }

  /**
   * 计算指定索引处的点尺寸
   * pointGradient=false → 统一 pointSize
   * pointGradientDirection='ascend' → 首小尾大（尾点 = maxSize，首点 = maxSize/3）
   * pointGradientDirection='descend' → 首大尾小（首点 = maxSize，尾点 = maxSize/3）
   * @param index {number} 点索引
   * @returns {number} 点尺寸（像素）
   * @private
   */
  _getPointSize(index) {
    let maxSize = this._pointStyle.pointSize
    let count = this._positions.length
    if (count <= 1) {
      return maxSize
    }
    if (!this._pointStyle.pointGradient) {
      return maxSize
    }
    let ratio = index / (count - 1)
    if (this._pointStyle.pointGradientDirection === 'descend') {
      return maxSize * (1 - (2 / 3) * ratio)
    }
    return maxSize * (1 / 3 + (2 / 3) * ratio)
  }

  /**
   * 为每个坐标创建发光 billboard entity
   * @private
   */
  _createPoints() {
    if (!this._showPoints || !this._layer) {
      return
    }
    if (this._pointEntities.length > 0) {
      return
    }
    let glowImage = this._createGlowImage(this._pointStyle.pointColor)
    for (let i = 0; i < this._positions.length; i++) {
      this._addPointEntity(i, glowImage)
    }
  }

  /**
   * 在指定索引处添加单个 billboard entity
   * position/width/height 均使用 CallbackProperty，坐标变更时自动响应
   * @param index {number} 索引位置
   * @param glowImage {string?} 发光图片 data url，为空时自动生成
   * @returns {Cesium.Entity|null}
   * @private
   */
  _addPointEntity(index, glowImage) {
    if (!this._layer) {
      return null
    }
    if (!glowImage) {
      glowImage = this._createGlowImage(this._pointStyle.pointColor)
    }
    let self = this
    let entity = this._layer.delegate.entities.add({
      position: new Cesium.CallbackProperty(() => {
        if (entity._trajIndex === undefined) {
          return undefined
        }
        self._ensureCartesianCache()
        return self._cachedCartesianPositions[entity._trajIndex]
      }, false),
      billboard: {
        image: glowImage,
        width: new Cesium.CallbackProperty(() => {
          if (entity._trajIndex === undefined) {
            return 0
          }
          return self._getPointSize(entity._trajIndex)
        }, false),
        height: new Cesium.CallbackProperty(() => {
          if (entity._trajIndex === undefined) {
            return 0
          }
          return self._getPointSize(entity._trajIndex)
        }, false),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    entity._trajIndex = index
    entity.overlayId = this._id
    entity.layerId = this._layer?.layerId
    this._pointEntities.splice(index, 0, entity)
    this._updatePointIndices(index)
    return entity
  }

  /**
   * 移除指定索引的 billboard entity
   * @param index {number} 索引位置
   * @private
   */
  _removePointEntity(index) {
    let entity = this._pointEntities[index]
    if (entity && this._layer?.delegate?.entities) {
      this._layer.delegate.entities.remove(entity)
    }
    this._pointEntities.splice(index, 1)
    this._updatePointIndices(index)
  }

  /**
   * 从指定索引开始更新所有 entity 的 _trajIndex
   * @param fromIndex {number} 起始索引
   * @private
   */
  _updatePointIndices(fromIndex) {
    for (let i = fromIndex; i < this._pointEntities.length; i++) {
      this._pointEntities[i]._trajIndex = i
    }
  }

  /**
   * 标记坐标为脏，清空 Cartesian3 缓存
   * @private
   */
  _markPositionsDirty() {
    this._positionsDirty = true
    this._cachedCartesianPositions = null
  }

  /**
   * 确保 Cartesian3 缓存有效，脏标记时重算
   * @private
   */
  _ensureCartesianCache() {
    if (this._positionsDirty || !this._cachedCartesianPositions) {
      this._cachedCartesianPositions =
        Transform.transformWGS84ArrayToCartesianArray(this._positions)
      this._positionsDirty = false
    }
  }

  /**
   * 重建所有分点 entity（先移除再创建）
   * @private
   */
  _recreatePoints() {
    this._removePoints()
    this._createPoints()
  }

  /**
   * 移除所有分点 entity
   * @private
   */
  _removePoints() {
    if (this._layer?.delegate?.entities) {
      this._pointEntities.forEach((entity) => {
        this._layer.delegate.entities.remove(entity)
      })
    }
    this._pointEntities = []
  }

  /**
   * 从拾取事件中提取轨迹点数据，并向事件载荷注入
   * trajectoryIndex / trajectoryPosition / trajectoryPositions 字段
   * @param e 拾取事件对象
   * @returns {{index: number, position: *}|null}
   * @private
   */
  _getPointData(e) {
    let entity = e?.target?.id
    if (!entity || entity._trajIndex === undefined) {
      return null
    }
    let index = entity._trajIndex
    let pos = this._positions[index]
    if (!pos) {
      return null
    }
    e.trajectoryIndex = index
    e.trajectoryPosition = pos
    e.trajectoryPositions = this._positions
    return { index, position: pos }
  }

  /**
   * 在指定窗口位置显示 tooltip
   * @param e 事件对象
   * @param data {{index: number, position: *}} 点位数据
   * @private
   */
  _showTooltip(e, data) {
    if (!this._tooltipContent) {
      return
    }
    let viewer = this._layer?.viewer
    if (viewer && viewer.tooltip) {
      viewer.tooltip.enable = true
      viewer.tooltip.showAt(
        e.windowPosition,
        this._tooltipContent(data.index, data.position, this._positions)
      )
    }
  }

  /**
   * 隐藏 tooltip
   * @private
   */
  _hideTooltip() {
    let viewer = this._layer?.viewer
    if (viewer && viewer.tooltip) {
      let wrapper = viewer.tooltip._wrapper
      if (wrapper) {
        wrapper.style.visibility = 'hidden'
      }
    }
  }

  /**
   * 鼠标移入处理（注入载荷 + 悬停 tooltip）
   * @param e
   * @private
   */
  _onMouseOver(e) {
    let data = this._getPointData(e)
    if (!data) {
      return
    }
    if (this._tooltipTrigger === 'hover' || this._tooltipTrigger === 'both') {
      this._showTooltip(e, data)
    }
  }

  /**
   * 鼠标移出处理
   * @private
   */
  _onMouseOut() {
    if (this._tooltipTrigger === 'hover' || this._tooltipTrigger === 'both') {
      this._hideTooltip()
    }
  }

  /**
   * 点击处理（注入载荷 + 点击 tooltip）
   * @param e
   * @private
   */
  _onClick(e) {
    let data = this._getPointData(e)
    if (!data) {
      return
    }
    if (this._tooltipTrigger === 'click' || this._tooltipTrigger === 'both') {
      this._showTooltip(e, data)
    }
  }

  /**
   * viewer 级点击处理，点击空白处时隐藏 tooltip
   * @param e
   * @private
   */
  _onViewerClick(e) {
    let entity = e?.target?.id
    if (entity && this._pointEntities.indexOf(entity) !== -1) {
      return
    }
    this._hideTooltip()
  }

  /**
   * 挂载到图层时的钩子：创建分点、注册事件
   * @private
   */
  _mountedHook() {
    this._createPoints()
    this.on(MouseEventType.MOUSE_OVER, this._onMouseOver, this)
    this.on(MouseEventType.MOUSE_OUT, this._onMouseOut, this)
    this.on(MouseEventType.CLICK, this._onClick, this)
    if (this._tooltipTrigger === 'click' || this._tooltipTrigger === 'both') {
      let viewer = this._layer?.viewer
      if (viewer) {
        viewer.on(MouseEventType.CLICK, this._onViewerClick, this)
      }
    }
  }

  /**
   * 从图层移除时的钩子：移除分点、注销事件
   * @private
   */
  _removedHook() {
    this._removePoints()
    this.off(MouseEventType.MOUSE_OVER, this._onMouseOver, this)
    this.off(MouseEventType.MOUSE_OUT, this._onMouseOut, this)
    this.off(MouseEventType.CLICK, this._onClick, this)
    let viewer = this._layer?.viewer
    if (viewer) {
      viewer.off(MouseEventType.CLICK, this._onViewerClick, this)
    }
  }

  /**
   * 设置发光线样式
   * 传入 color / glowPower / dash 等会重建线材质；传入 material 则使用自定义材质
   * @param style {Object} 线样式配置
   * @returns {TrajectoryLine}
   */
  setStyle(style) {
    if (!style || Object.keys(style).length === 0) {
      return this
    }
    delete style['positions']
    Util.merge(this._lineStyle, style)
    if (this._delegate.polyline) {
      if (
        style.material ||
        style.color ||
        style.glowPower ||
        style.glow !== undefined ||
        style.dash !== undefined ||
        style.dashLength !== undefined ||
        style.dashPattern !== undefined
      ) {
        this._delegate.polyline.material = this._createLineMaterial()
      }
      if (style.width !== undefined) {
        this._delegate.polyline.width = style.width
      }
      if (style.clampToGround !== undefined) {
        this._delegate.polyline.clampToGround = style.clampToGround
      }
    }
    return this
  }

  /**
   * 设置点位样式
   * 仅更新颜色或发光模式时直接替换 billboard 图片，不重建 entity；
   * 更新 pointSize / pointGradient / pointGradientDirection 时通过 CallbackProperty 自动响应
   * @param style {Object} 点样式配置
   * @returns {TrajectoryLine}
   */
  setPointStyle(style) {
    if (!style || Object.keys(style).length === 0) {
      return this
    }
    let oldColor = this._pointStyle.pointColor
    let oldGlow = this._pointStyle.pointGlow
    Util.merge(this._pointStyle, style)
    let colorChanged = style.pointColor && style.pointColor !== oldColor
    let glowChanged =
      style.pointGlow !== undefined && style.pointGlow !== oldGlow
    if (colorChanged || glowChanged) {
      let image = this._createGlowImage(this._pointStyle.pointColor)
      this._pointEntities.forEach((e) => {
        e.billboard.image = image
      })
    }
    return this
  }

  /**
   * 设置分点提示内容回调
   * @param callback {(index: number, position: *, allPositions: *) => string}
   * @returns {TrajectoryLine}
   */
  setTooltipContent(callback) {
    this._tooltipContent = callback
    return this
  }

  /**
   * 动态切换分点显隐，无需重建 entity
   * @param show {boolean}
   */
  set showPoints(show) {
    this._showPoints = show
    if (show && this._pointEntities.length === 0 && this._layer) {
      this._createPoints()
    } else {
      this._pointEntities.forEach((e) => {
        e.show = show
      })
    }
  }

  /** 获取当前分点显隐状态 */
  get showPoints() {
    return this._showPoints
  }

  /**
   * 动态切换 tooltip 触发方式，自动注册/注销 viewer 级 click 事件
   * @param trigger {'hover'|'click'|'both'}
   */
  set tooltipTrigger(trigger) {
    let oldTrigger = this._tooltipTrigger
    this._tooltipTrigger = trigger
    if (!this._layer) {
      return
    }
    let oldNeedsViewerClick = oldTrigger === 'click' || oldTrigger === 'both'
    let newNeedsViewerClick = trigger === 'click' || trigger === 'both'
    let viewer = this._layer?.viewer
    if (!oldNeedsViewerClick && newNeedsViewerClick && viewer) {
      viewer.on(MouseEventType.CLICK, this._onViewerClick, this)
    } else if (oldNeedsViewerClick && !newNeedsViewerClick && viewer) {
      viewer.off(MouseEventType.CLICK, this._onViewerClick, this)
    }
  }

  /** 获取当前 tooltip 触发方式 */
  get tooltipTrigger() {
    return this._tooltipTrigger
  }

  /**
   * 从 Cesium Entity 解析创建 TrajectoryLine
   * @param entity {Cesium.Entity}
   * @returns {TrajectoryLine|undefined}
   */
  static fromEntity(entity) {
    let trajectory = undefined
    let now = Cesium.JulianDate.now()
    if (entity.polyline) {
      let positions = Transform.transformCartesianArrayToWGS84Array(
        entity.polyline.positions.getValue(now)
      )
      trajectory = new TrajectoryLine(positions)
      trajectory.attr = {
        ...entity?.properties?.getValue(now),
      }
    }
    return trajectory
  }
}

Overlay.registerType('trajectory_line')

export default TrajectoryLine
