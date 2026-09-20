import { Cesium } from '../../../libs'
import Overlay from '../Overlay'
import State from '../../state/State'
import Parse from '../../parse/Parse'
import { Util } from '../../utils'
import { Transform } from '../../transform'
import Polyline from './Polyline'

/**
 * 描边圆周的分段数（决定描边平滑度）
 */
const OUTLINE_SEGMENTS = 720

class Circle extends Overlay {
  constructor(center, radius) {
    super()
    this._delegate = new Cesium.Entity({ ellipse: {} })
    this._center = Parse.parsePosition(center)
    this._radius = +radius || 0
    this._rotateAmount = 0
    this._stRotation = 0
    /** 是否已安装旋转回调（仅在 rotateAmount !== 0 时为真，避免动态几何） */
    this._stRotationCallback = undefined
    this._outline = false
    this._outlineColor = Cesium.Color.RED
    this._outlineWidth = 1
    this._outlinePolyline = undefined
    this._state = State.INITIALIZED
  }

  get type() {
    return Overlay.getOverlayType('circle')
  }

  set center(center) {
    this._center = Parse.parsePosition(center)
    this._delegate.position = Transform.transformWGS84ToCartesian(this._center)
    this._updateOutline()
  }

  get center() {
    return this._center
  }

  set radius(radius) {
    this._radius = +radius
    this._delegate.ellipse.semiMajorAxis = this._radius
    this._delegate.ellipse.semiMinorAxis = this._radius
    this._updateOutline()
  }

  get radius() {
    return this._radius
  }

  /**
   * 设置旋转量（度/秒）
   *
   * 【性能关键修正】旧实现无条件安装一个非恒定 `CallbackProperty` 到 `ellipse.stRotation`：
   * ```js
   * this._delegate.ellipse.stRotation = new Cesium.CallbackProperty(() => {
   *   this._stRotation += this._rotateAmount      // ① 按**帧**累加
   *   ...
   * }, false)                                      // ② isConstant=false → 动态几何
   * ```
   * 带来两个问题：
   *  1. `stRotation` 动态化 → **椭圆几何每帧销毁重建**（与 Polyline 同类问题）；
   *  2. 旋转量按帧累加而非按时间 → **转速随帧率变化**，帧率越低转得越慢（物理上不正确）。
   *
   * 现改为：
   *  - `rotateAmount` 为 0（默认，覆盖绝大多数用法）时**完全不安装回调**，几何保持静态；
   *  - 需要旋转时，改用**基于时间**的计算（`JulianDate.secondsOfDay`），保证角速度恒定；
   *  - 显式关闭旋转（设为 0）时移除回调，恢复静态几何。
   */
  set rotateAmount(amount) {
    this._rotateAmount = +amount
    if (!this._delegate || !this._delegate.ellipse) {
      return
    }
    if (this._rotateAmount === 0) {
      /**
       * 关闭旋转：移除回调，恢复静态几何（避免继续每帧重建）
       */
      this._delegate.ellipse.stRotation = 0
      this._stRotationCallback = undefined
      return
    }
    if (this._stRotationCallback) {
      return
    }
    /**
     * 基于时间（秒 → 度）计算旋转角，与帧率解耦
     * 注意：Cesium 无静态 `JulianDate.secondsOfDay`，统一走 `Util.getElapsedSeconds`
     */
    this._stRotationCallback = true
    this._delegate.ellipse.stRotation = new Cesium.CallbackProperty(
      (time) => {
        const seconds = Util.getElapsedSeconds(time)
        return Cesium.Math.toRadians((seconds * this._rotateAmount) % 360)
      },
      false
    )
  }

  get rotateAmount() {
    return this._rotateAmount
  }

  set outline(outline) {
    this._outline = outline
    if (this._outline) {
      this._updateOutline()
    } else if (this._outlinePolyline) {
      this._outlinePolyline.remove()
      this._outlinePolyline = undefined
    }
  }

  get outline() {
    return this._outline
  }

  set outlineColor(outlineColor) {
    this._outlineColor = outlineColor
    if (this._outlinePolyline) {
      this._outlinePolyline.setStyle({
        material: this._outlineColor,
      })
    }
  }

  get outlineColor() {
    return this._outlineColor
  }

  set outlineWidth(outlineWidth) {
    this._outlineWidth = +outlineWidth
    if (this._outlinePolyline) {
      this._outlinePolyline.setStyle({
        width: this._outlineWidth,
      })
    }
  }

  get outlineWidth() {
    return this._outlineWidth
  }

  /**
   * Computes the outline positions using local ENU coordinate system
   * @returns {Position[]}
   * @private
   */
  _computeOutlinePositions() {
    return Transform.generateCirclePositions(
      this._center,
      this._radius,
      OUTLINE_SEGMENTS,
      this._center.alt || 0
    )
  }

  /**
   * Creates or updates the outline polyline
   * @private
   */
  _updateOutline() {
    if (!this._outline || !this._layer) {
      return
    }
    if (!this._outlinePolyline) {
      this._outlinePolyline = new Polyline(this._computeOutlinePositions())
      this._outlinePolyline.setStyle({
        width: this._outlineWidth,
        material: this._outlineColor,
      })
      this._layer.addOverlay(this._outlinePolyline)
    } else {
      this._outlinePolyline.positions = this._computeOutlinePositions()
    }
  }

  _removedHook() {
    if (this._outlinePolyline) {
      this._outlinePolyline.remove()
      this._outlinePolyline = undefined
    }
  }

  _mountedHook() {
    /**
     * set the location
     */
    this.center = this._center
    this.radius = this._radius
  }

  /**
   * Sets Text with Style
   * @param text
   * @param textStyle
   * @returns {Circle}
   */
  setLabel(text, textStyle) {
    this._delegate.position = Transform.transformWGS84ToCartesian(this._center)
    this._delegate.label = {
      ...textStyle,
      text: text,
    }
    return this
  }

  /**
   *
   * @param style
   * @returns {Circle}
   */
  setStyle(style) {
    if (!style || Object.keys(style).length === 0) {
      return this
    }
    let { outline, outlineColor, outlineWidth, ...rest } = style
    if (outline !== undefined) {
      this.outline = outline
    }
    if (outlineColor !== undefined) {
      this.outlineColor = outlineColor
    }
    if (outlineWidth !== undefined) {
      this.outlineWidth = outlineWidth
    }
    delete rest['center']
    Util.merge(this._style, rest)
    Util.merge(this._delegate.ellipse, rest)
    return this
  }
}

Overlay.registerType('circle')

export default Circle
