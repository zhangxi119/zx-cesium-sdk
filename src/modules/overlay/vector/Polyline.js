import { Cesium } from '../../../libs'
import Overlay from '../Overlay'
import State from '../../state/State'
import Parse from '../../parse/Parse'
import { Util } from '../../utils'
import { Transform } from '../../transform'
import { center, distance } from '../../math'

class Polyline extends Overlay {
  /**
   * 构造函数
   * @param positions {Position[]|string} 坐标点数组
   * @param options {Object} 可选配置项
   * @param options.dynamicPositions {boolean} 是否启用动态坐标模式（默认 false，实时连线防闪动）
   * @param options.arcType {number} 动态模式下的弧线类型（默认 ArcType.NONE，跳过逐帧大地线加密）
   */
  constructor(positions, options = {}) {
    super()
    this._positions = Parse.parsePositions(positions)
    /**
     * 【性能关键修正】positions 默认改为**恒定数组**（不再默认使用非恒定 CallbackProperty）
     *
     * 旧实现固定把 positions 写成 `new Cesium.CallbackProperty(fn, false)`，
     * `isConstant === false` 会使 Cesium 把这条线判定为**动态几何** ——
     * 每帧都要对属性求值并走动态更新链路；对静态渲染 / 低频更新的线而言
     * 这笔逐帧开销是纯浪费，且多线叠加后按「线数 × 帧率」放大。
     *
     * 改为普通数组后，Cesium 会将其包装为 `ConstantProperty`，
     * **几何只在 positions 被赋值时构建一次**；数据变化时通过下方的 setter 重新赋值即可。
     *
     * 【重要边界】高频重写恒定属性（如实时连线每秒多次重赋值）会触发静态批处理的
     * 「图元移除 → 异步重建」可见窗口（唯一实体材质项下表现为每次更新闪动一次），
     * 该场景改为 `dynamicPositions: true` —— 动态几何在当前 Cesium 中走
     * `PolylineCollection` 顶点缓冲**原地更新**（非重建），无可见窗口；
     * 详见 `TrajectoryLine` 构造函数同名注释与 CHANGES。
     */
    this._dynamicPositions = options.dynamicPositions === true
    /** 动态模式下的坐标属性（CallbackProperty：每次求值返回最新 Cartesian 缓存） */
    this._positionsProperty = undefined
    /** 动态模式的 Cartesian 缓存（坐标变更时整体重建，回调直接返回该引用） */
    this._cartesianPositions = undefined
    if (this._dynamicPositions) {
      this._cartesianPositions = Transform.transformWGS84ArrayToCartesianArray(
        this._positions
      )
      this._positionsProperty = new Cesium.CallbackProperty(
        () => this._cartesianPositions,
        false
      )
    }
    this._delegate = new Cesium.Entity({
      polyline: {
        ...(this._dynamicPositions
          ? {
              positions: this._positionsProperty,
              /**
               * 动态模式默认跳过大地线加密：动态几何每帧取值，GEODESIC 会逐帧
               * `generateCartesianArc` 加密（开销随点数放大）；
               * 需要加密时经构造参数 `arcType` 显式传入
               */
              arcType: options.arcType ?? Cesium.ArcType.NONE,
            }
          : {
              positions: Transform.transformWGS84ArrayToCartesianArray(
                this._positions
              ),
            }),
      },
    })
    /** 最近一次同步到实体的点位数组引用（用于避免挂载时重复构建几何） */
    this._syncedPositions = this._positions
    this._state = State.INITIALIZED
  }

  get type() {
    return Overlay.getOverlayType('polyline')
  }

  /** 是否启用动态坐标模式（实时连线防闪动，构造后不可变） */
  get dynamicPositions() {
    return this._dynamicPositions
  }

  set positions(positions) {
    this._positions = Parse.parsePositions(positions)
    this._syncPositions()
  }

  get positions() {
    return this._positions
  }

  /**
   * 把当前 WGS84 点位同步到实体上的坐标属性
   *
   * 静态模式（默认）：`PolylineGraphics.positions` 每次**赋值**都会触发
   * `definitionChanged`，进而让 Cesium 重建一次几何 —— 这是期望行为
   * （低频、仅在数据变化时发生）；注意必须是**新的外层数组**，
   * 复用同一数组实例不会触发变更通知。
   * 动态模式（dynamicPositions: true）：只刷新回调数据源（Cartesian 缓存），
   * **不重写实体属性** —— 属性实例保持不变，Cesium 走 PolylineCollection
   * 顶点缓冲原地更新，不存在图元销毁/异步重建窗口（无闪动）。
   * @private
   */
  _syncPositions() {
    if (!this._delegate || !this._delegate.polyline) {
      return
    }
    this._syncedPositions = this._positions
    if (this._dynamicPositions) {
      this._cartesianPositions = Transform.transformWGS84ArrayToCartesianArray(
        this._positions
      )
      return
    }
    this._delegate.polyline.positions =
      Transform.transformWGS84ArrayToCartesianArray(this._positions)
  }

  get center() {
    return center(this._positions)
  }

  get distance() {
    return distance(this._positions)
  }

  _mountedHook() {
    /**
     * 构造期已把 positions 同步到实体；此处仅在点位数组被**外部直接替换**
     * （例如子类自行改写 `_positions`）时才需要重新同步，避免挂载时多构建一次几何。
     */
    if (this._syncedPositions !== this._positions) {
      this._syncPositions()
    }
  }

  /**
   * Sets Text
   * @param text
   * @param textStyle
   * @returns {Polyline}
   */
  setLabel(text, textStyle) {
    this._delegate.position = Transform.transformWGS84ToCartesian(this.center)
    this._delegate.label = {
      text: text,
      ...textStyle,
    }
    return this
  }

  /**
   * Sets style
   *
   * ## 线宽语义保护（opt-in，**默认不干预**）
   * 业务线宽多来自后端配置或表单，越界时 Cesium 的反应是**静默异常**：
   * `width < 1` 会让整条线不绘制（`PolylineVS`：`if (width < 1.0) { show = 0.0; }`），
   * 过大的宽度则生成极宽四边形、遮挡地图并消耗填充率。
   *
   * 通过 `clampLineWidth` 即可让本方法把宽度规整到 `[1, 12]`（CSS 像素）：
   * ```js
   * polyline.setStyle({ width: 0.5, clampLineWidth: true })   // → 1
   * polyline.setStyle({ width: 100, clampLineWidth: true })   // → 12
   * ```
   *
   * 三个语义要点：
   * 1. **默认关闭**：不传开关时完全按调用方给的值写入，与既有版本逐字节一致；
   * 2. **`strictLineWidth: true` 优先级更高**：用于个别确实需要越界线宽的图元（逃生舱）；
   * 3. **两个开关都会被消费掉**：不会透传成实体上的无用属性（Cesium 图形对象只认自己的字段）。
   *
   * @param style
   * @returns {Polyline}
   */
  setStyle(style) {
    if (!style || Object.keys(style).length === 0) {
      return this
    }
    delete style['positions']
    // 线宽语义保护开关：仅在显式开启且未被严格模式否决时生效
    const clampWidth =
      style['clampLineWidth'] === true && style['strictLineWidth'] !== true
    delete style['clampLineWidth']
    delete style['strictLineWidth']
    if (clampWidth && style['width'] != null) {
      style['width'] = Util.clampLineWidth(style['width'])
    }
    Util.merge(this._style, style)
    Util.merge(this._delegate.polyline, style)
    return this
  }

  /**
   * Parse from entity
   * @param entity
   * @returns {Polyline}
   */
  static fromEntity(entity) {
    let polyline = undefined
    let now = Cesium.JulianDate.now()
    if (entity.polyline) {
      let positions = Transform.transformCartesianArrayToWGS84Array(
        entity.polyline.positions.getValue(now)
      )
      polyline = new Polyline(positions)
      polyline.attr = {
        ...entity?.properties?.getValue(now),
      }
    }
    return polyline
  }
}

Overlay.registerType('polyline')

export default Polyline
