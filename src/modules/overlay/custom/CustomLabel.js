/**
 * @Author : Caven Chen
 */
import { Cesium } from '../../../libs'
import Overlay from '../Overlay'
import Parse from '../../parse/Parse'
import State from '../../state/State'
import { Transform } from '../../transform'
import { Util } from '../../utils'

class CustomLabel extends Overlay {
  constructor(position, text) {
    super()
    this._delegate = new Cesium.Entity({ label: {} })
    this._position = Parse.parsePosition(position)
    this._text = text
    this._state = State.INITIALIZED
  }

  get type() {
    return Overlay.getOverlayType('custom_label')
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

  set text(text) {
    this._text = text
    this._delegate.label.text = this._text
  }

  get text() {
    return this._text
  }

  _mountedHook() {
    /**
     * set the location
     */
    this.position = this._position
    /**
     *  initialize the Overlay parameter
     */
    this.text = this._text
  }

  /**
   *
   * @param {*} style
   */
  setStyle(style) {
    if (!style || Object.keys(style).length === 0) {
      return this
    }
    delete style['text']
    Util.merge(this._style, style)
    Util.merge(this._delegate.label, style)
    return this
  }

  /**
   * Sets  VLine style
   * @param style
   * @returns {CustomLabel}
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
   * Sets bottom circle
   *
   * 【性能修正】与 `CustomBillboard.setBottomCircle` 一致：
   * `rotateAmount` 为 0 时使用常量（保持静态几何）；需要旋转时基于**时间**计算，
   * 避免「每帧重建几何」与「转速随帧率变化」两个问题。
   * @param radius
   * @param style
   * @param rotateAmount 旋转角速度（度/秒，0 表示不旋转）
   * @returns {CustomLabel}
   */
  setBottomCircle(radius, style = {}, rotateAmount = 0) {
    const amount = +rotateAmount || 0
    this._delegate.ellipse = {
      ...style,
      semiMajorAxis: radius,
      semiMinorAxis: radius,
      stRotation:
        amount === 0
          ? 0
          : new Cesium.CallbackProperty((time) => {
              const seconds = Util.getElapsedSeconds(time)
              return Cesium.Math.toRadians((seconds * amount) % 360)
            }, false),
    }
    return this
  }
}

Overlay.registerType('custom_label')

export default CustomLabel
