import { Cesium } from '../../../libs'
import State from '../../state/State'
import { Util, DomUtil } from '../../utils'
import { SceneEventType } from '../../event'
import Widget from '../Widget'

class HawkeyeMap extends Widget {
  constructor() {
    super()
    this._wrapper = DomUtil.create('div', 'widget hawkeye-map', null)
    this._wrapper.setAttribute('id', Util.uuid())
    this._map = undefined
    /** 安装/启用前的相机灵敏度原值，用于禁用时恢复 */
    this._originPercentageChanged = undefined
    this._state = State.INITIALIZED
  }

  get type() {
    return Widget.getWidgetType('hawkeye_map')
  }

  /**
   *
   * @private
   */
  _mountContent() {
    let map = new Cesium.CesiumWidget(this._wrapper, {
      sceneMode: Cesium.SceneMode.SCENE2D,
      creditContainer: document.createElement('div'),
      creditViewport: document.createElement('div'),
      baseLayer: false,
    })
    map.imageryLayers.removeAll()
    map.canvas.parentNode.className = 'viewer-canvas'
    Util.merge(map.scene.screenSpaceCameraController, {
      enableRotate: false,
      enableTranslate: false,
      enableZoom: false,
      enableTilt: false,
      enableLook: false,
      maximumZoomDistance: 40489014.0,
    })
    this._map = map
    this._ready = true
  }

  /**
   *
   * @private
   */
  _bindEvent() {
    this._viewer.on(SceneEventType.CAMERA_CHANGED, this._syncMap, this)
  }

  /**
   *
   * @private
   */
  _unbindEvent() {
    this._viewer.off(SceneEventType.CAMERA_CHANGED, this._syncMap, this)
  }

  /**
   *
   * @private
   */
  _installHook() {
    const self = this
    Object.defineProperty(this._viewer, 'hawkeyeMap', {
      get() {
        return self
      },
    })
  }

  /**
   * 启用/禁用联动
   *
   * 性能修正：相机变化灵敏度（camera.percentageChanged）不再在安装时无条件修改。
   *
   * 原实现在 `_installHook()` 中直接写 `this._viewer.camera.percentageChanged = 0.01`，
   * 而 `Widget.install()` 是无条件执行的 —— 也就是说：**即使用户从未启用鹰眼图**，
   * 主相机的变化事件灵敏度也会被从 Cesium 默认的 0.5 提升到 0.01（**敏感度 50 倍**），
   * 导致 `camera.changed` / `camera.moveEnd` 事件被高频触发，产生持续的全局开销。
   *
   * 现改为：仅在启用时设置，禁用时**恢复安装前的原值**。
   * @private
   */
  _enableHook() {
    /**
     * 复用基类逻辑（挂载内容 / 绑定或解绑事件）
     */
    super._enableHook()
    const camera = this._viewer?.camera
    if (!camera) {
      return
    }
    if (this._enable) {
      /**
       * 首次启用时记录原值，供禁用时恢复
       */
      if (this._originPercentageChanged === undefined) {
        this._originPercentageChanged = camera.percentageChanged
      }
      camera.percentageChanged = 0.01
    } else if (this._originPercentageChanged !== undefined) {
      camera.percentageChanged = this._originPercentageChanged
      this._originPercentageChanged = undefined
    }
  }

  /**
   *
   * @returns {boolean}
   * @private
   */
  _syncMap() {
    let viewCenter = new Cesium.Cartesian2(
      Math.floor(this._viewer.canvas.clientWidth / 2),
      Math.floor(this._viewer.canvas.clientHeight / 2)
    )
    let worldPosition = this._viewer.scene.camera.pickEllipsoid(viewCenter)
    if (!worldPosition) {
      return false
    }
    let distance = Cesium.Cartesian3.distance(
      worldPosition,
      this._viewer.scene.camera.positionWC
    )
    this._map.scene.camera.lookAt(
      worldPosition,
      new Cesium.Cartesian3(0.0, 0.0, distance)
    )
  }

  /**
   *
   * @param baseLayer
   * @returns {HawkeyeMap}
   */
  addBaseLayer(baseLayer) {
    if (!this._map || !this._enable) {
      return this
    }
    if (baseLayer) {
      this._map.imageryLayers.removeAll()
      if (!Array.isArray(baseLayer)) {
        baseLayer = [baseLayer]
      }
      baseLayer.forEach((item) => {
        this._map.imageryLayers.add(
          Cesium.ImageryLayer.fromProviderAsync(item, {})
        )
      })
    }
    return this
  }
}

Widget.registerType('hawkeye_map')

export default HawkeyeMap
