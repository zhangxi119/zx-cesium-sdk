import { Cesium } from '../../../libs'
import Overlay from '../Overlay'
import Parse from '../../parse/Parse'
import State from '../../state/State'
import { Transform } from '../../transform'
import { Util } from '../../utils'

class Model extends Overlay {
  constructor(position, modelUrl) {
    super()
    this._delegate = new Cesium.Entity({ model: {} })
    this._position = Parse.parsePosition(position)
    this._modelUrl = modelUrl
    this._rotateAmount = 0
    this._state = State.INITIALIZED
  }

  get type() {
    return Overlay.getOverlayType('model')
  }

  set position(position) {
    this._position = Parse.parsePosition(position)
    this._delegate.position = Transform.transformWGS84ToCartesian(
      this._position
    )
    if (this._rotateAmount === 0) {
      /**
       * 朝向改为静态：仅在位置变化时重算一次（不再逐帧求值）
       */
      this._delegate.orientation = this._computeOrientation(
        this._position.heading
      )
    }
  }

  get position() {
    return this._position
  }

  set modelUrl(modelUrl) {
    this._modelUrl = modelUrl
    this._delegate.model.uri = this._modelUrl
  }

  get modelUrl() {
    return this._modelUrl
  }

  /**
   * 设置自转速度（度/秒）
   *
   * 【性能修正】`rotateAmount` 为 0（默认）时**移除回调**，恢复静态朝向（零逐帧开销）。
   * 旧实现无条件安装非恒定 `CallbackProperty` 到 `orientation`：
   *  1. 使模型朝向被判定为动态属性，每帧重新求值并更新模型矩阵；
   *  2. 旋转量按**帧**累加（`this._position.heading += amount`），转速随帧率变化，
   *     并且会**副作用式地改写 `_position.heading`**（污染业务坐标数据）。
   * 现改为基于**时间**计算，且不改写 `_position`。
   */
  set rotateAmount(amount) {
    this._rotateAmount = +amount
    if (this._rotateAmount === 0) {
      this._delegate.orientation = this._computeOrientation(
        this._position.heading
      )
      return
    }
    const baseHeading = this._position.heading || 0
    this._delegate.orientation = new Cesium.CallbackProperty((time) => {
      const seconds = Util.getElapsedSeconds(time)
      return this._computeOrientation(
        baseHeading + ((seconds * this._rotateAmount) % 360)
      )
    }, false)
  }

  /**
   * 按给定航向计算朝向四元数（不修改 `_position`）
   * @param heading 航向角（度）
   * @returns {Cesium.Quaternion}
   * @private
   */
  _computeOrientation(heading) {
    return Cesium.Transforms.headingPitchRollQuaternion(
      Transform.transformWGS84ToCartesian(this._position),
      new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(heading),
        Cesium.Math.toRadians(this._position.pitch),
        Cesium.Math.toRadians(this._position.roll)
      )
    )
  }

  get rotateAmount() {
    return this._rotateAmount
  }

  _mountedHook() {
    /**
     * set the location
     */
    this.position = this._position
    /**
     *  initialize the Overlay parameter
     */
    this.modelUrl = this._modelUrl
  }

  /**
   * Sets style
   * @param style
   * @returns {Model}
   */
  setStyle(style) {
    if (!style || Object.keys(style).length === 0) {
      return this
    }
    delete style['uri']
    Util.merge(this._style, style)
    Util.merge(this._delegate.model, style)
    return this
  }

  /**
   * Parse from entity
   * @param entity
   * @param modelUrl
   * @returns {Model}
   */
  static fromEntity(entity, modelUrl) {
    let now = Cesium.JulianDate.now()
    let position = Transform.transformCartesianToWGS84(
      entity.position.getValue(now)
    )
    let model = new Model(position, modelUrl)
    model.attr = {
      ...entity.properties.getValue(now),
    }
    return model
  }
}

Overlay.registerType('model')

export default Model
