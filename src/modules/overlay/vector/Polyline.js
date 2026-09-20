/**
 * @Author : Caven Chen
 * @Last Modified By : zhangxi119
 * @Last Modified Time : 2026-09-20 15:45:00
 */

import { Cesium } from '../../../libs'
import Overlay from '../Overlay'
import State from '../../state/State'
import Parse from '../../parse/Parse'
import { Util } from '../../utils'
import { Transform } from '../../transform'
import { center, distance } from '../../math'

class Polyline extends Overlay {
  constructor(positions) {
    super()
    this._positions = Parse.parsePositions(positions)
    /**
     * 【性能关键修正】positions 改为**恒定数组**（不再使用非恒定 CallbackProperty）
     *
     * 旧实现把 positions 写成 `new Cesium.CallbackProperty(fn, false)`，
     * `isConstant === false` 会让 Cesium 把这条线判定为**动态几何**，于是
     * `DynamicGeometryUpdater.prototype.update()` **每帧**都会执行：
     * ```js
     * primitives.removeAndDestroy(this._primitive);          // 销毁 Primitive 及其 GPU 顶点缓冲
     * appearance = new MaterialAppearance({ ... });           // 每帧新建 Appearance
     * this._primitive = primitives.add(new Primitive({...})); // 每帧新建 Primitive 并重新上传几何
     * ```
     * 代价按「线数 × 点数 × 帧率」放大：一条 721 点的圆周描边每秒就要重建 60 次 GPU 缓冲，
     * 是三维稳态帧率的主要瓶颈。
     *
     * 改为普通数组后，Cesium 会将其包装为 `ConstantProperty`，
     * **几何只在 positions 被赋值时构建一次**；数据变化时通过下方的 setter 重新赋值即可。
     */
    this._delegate = new Cesium.Entity({
      polyline: {
        positions: Transform.transformWGS84ArrayToCartesianArray(this._positions),
      },
    })
    /** 最近一次同步到实体的点位数组引用（用于避免挂载时重复构建几何） */
    this._syncedPositions = this._positions
    this._state = State.INITIALIZED
  }

  get type() {
    return Overlay.getOverlayType('polyline')
  }

  set positions(positions) {
    this._positions = Parse.parsePositions(positions)
    this._syncPositions()
  }

  get positions() {
    return this._positions
  }

  /**
   * 把当前 WGS84 点位同步到实体上的恒定属性
   *
   * 说明：`PolylineGraphics.positions` 每次**赋值**都会触发 `definitionChanged`，
   * 进而让 Cesium 重建一次几何 —— 这是期望行为（低频、仅在数据变化时发生）。
   * 注意必须是**新的外层数组**：复用同一数组实例不会触发变更通知。
   * @private
   */
  _syncPositions() {
    if (!this._delegate || !this._delegate.polyline) {
      return
    }
    this._syncedPositions = this._positions
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
