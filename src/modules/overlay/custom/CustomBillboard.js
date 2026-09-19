/**
 * @Author : Caven Chen
 */
import { Cesium } from '../../../libs'
import Overlay from '../Overlay'
import Parse from '../../parse/Parse'
import State from '../../state/State'
import { Transform } from '../../transform'
import { Util } from '../../utils'

class CustomBillboard extends Overlay {
  constructor(position, icon) {
    super()
    this._delegate = new Cesium.Entity({ billboard: {} })
    this._position = Parse.parsePosition(position)
    this._icon = icon
    this._size = [32, 32]
    this._state = State.INITIALIZED
  }

  get type() {
    return Overlay.getOverlayType('custom_billboard')
  }

  set position(position) {
    this._position = Parse.parsePosition(position)
    this._delegate.position = Transform.transformWGS84ToCartesian(
      this._position
    )
  }

  get position() {
    return this._position
  }

  set icon(icon) {
    this._icon = icon
    this._delegate.billboard.image = this._icon
  }

  get icon() {
    return this._icon
  }

  set size(size) {
    if (!Array.isArray(size)) {
      throw new Error('CustomBillboard: the size invalid')
    }
    this._size = size
    this._delegate.billboard.width = this._size[0] || 32
    this._delegate.billboard.height = this._size[1] || 32
  }

  get size() {
    return this._size
  }

  _mountedHook() {
    /**
     * set the location
     */
    this.position = this._position
    /**
     *  initialize the Overlay parameter
     */
    this.icon = this._icon
    this.size = this._size
  }

  /**
   * Sets label
   * @param text
   * @param textStyle
   * @returns {CustomBillboard}
   */
  setLabel(text, textStyle) {
    this._delegate.label = {
      ...textStyle,
      text: text,
    }
    return this
  }

  /**
   * Sets Style
   * @param style
   * @returns {CustomBillboard}
   */
  setStyle(style) {
    if (!style || Object.keys(style).length === 0) {
      return this
    }
    delete style['image'] && delete style['width'] && delete style['height']
    Util.merge(this._style, style)
    Util.merge(this._delegate.billboard, style)
    return this
  }

  /**
   * Sets VLine style
   * @param style
   * @returns {CustomBillboard}
   */
  setVLine(style = {}) {
    if (this._position.alt > 0 && !this._delegate.polyline) {
      let position = this._position.copy()
      position.alt = style.height || 0
      this._delegate.polyline = {
        ...style,
        positions: Transform.transformWGS84ArrayToCartesianArray([
          position,
          this._position,
        ]),
      }
    }
    return this
  }

  /**
   * 设置底部圆环
   *
   * 【性能修正】`rotateAmount` 为 0（默认）时不再安装非恒定回调。
   * 旧实现无条件写入 `stRotation: new Cesium.CallbackProperty(fn, false)`，
   * 使椭圆被判定为**动态几何**（每帧销毁重建 Primitive）；且其旋转量按**帧**累加，
   * 转速会随帧率变化。现改为：静态场景用常量 0；需要旋转时基于**时间**计算角速度。
   * @param {*} radius
   * @param {*} style
   * @param {*} rotateAmount 旋转角速度（度/秒，0 表示不旋转）
   */
  setBottomCircle(radius, style = {}, rotateAmount = 0) {
    this._delegate.ellipse = {
      ...style,
      semiMajorAxis: radius,
      semiMinorAxis: radius,
      stRotation: this._createStRotation(rotateAmount),
    }
    return this
  }

  /**
   * 构造 stRotation 属性值
   * @param {number} rotateAmount 旋转角速度（度/秒）
   * @returns {number|Cesium.CallbackProperty}
   * @private
   */
  _createStRotation(rotateAmount) {
    const amount = +rotateAmount || 0
    if (amount === 0) {
      /**
       * 不旋转：使用常量值，保持几何静态（零逐帧开销）
       */
      return 0
    }
    /**
     * 旋转：基于时间（秒 → 度）计算，与帧率解耦
     * 注意：Cesium 无静态 `JulianDate.secondsOfDay`，统一走 `Util.getElapsedSeconds`
     */
    return new Cesium.CallbackProperty((time) => {
      const seconds = Util.getElapsedSeconds(time)
      return Cesium.Math.toRadians((seconds * amount) % 360)
    }, false)
  }
}

Overlay.registerType('custom_billboard')

export default CustomBillboard
