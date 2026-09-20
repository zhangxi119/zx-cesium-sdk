import { Cesium } from '../../../libs'
import Widget from '../Widget'
import State from '../../state/State'
import { DomUtil } from '../../utils'

class Popup extends Widget {
  constructor() {
    super()
    this._wrapper = DomUtil.create('div', 'widget popup')
    this._config = { customClass: '' }
    this._position = undefined
    /** postRender 监听移除函数（避免重复注册与泄漏） */
    this._removePostRender = undefined
    /** wrapper 尺寸缓存（避免每帧读取 offsetWidth/offsetHeight 触发同步重排） */
    this._wrapperWidth = undefined
    this._wrapperHeight = undefined
    this._state = State.INITIALIZED
  }

  get type() {
    return Widget.getWidgetType('popup')
  }

  set config(config) {
    this._config = config
    this._invalidateSize()
    config.customClass && this._setCustomClass()
  }

  /**
   * 失效 wrapper 尺寸缓存（内容或类名变化后需重新测量）
   * @private
   */
  _invalidateSize() {
    this._wrapperWidth = undefined
    this._wrapperHeight = undefined
  }

  /**
   * binds event
   *
   * 说明：`scene.postRender` 是**每帧**回调，此处的内容必须尽量廉价。
   * 旧实现在 `_installHook()` 中先 `this.enable = true`（基类 `_enableHook()` 已经调用过
   * `_bindEvent()`），随后又**显式调用了一次 `this._bindEvent()`** ——
   * 导致同一回调在 `postRender` 上被注册**两次**：弹框可见时每帧执行两遍
   * 「世界坐标 → 窗口坐标」换算与 DOM 写入。现移除该重复调用。
   * @private
   */
  _bindEvent() {
    if (this._viewer && this._wrapper) {
      let self = this
      let scene = this._viewer.scene
      this._removePostRender = scene.postRender.addEventListener(() => {
        if (
          self._position &&
          self._enable &&
          self._updateWindowCoord &&
          self._wrapper.style.visibility === 'visible'
        ) {
          let windowCoord = Cesium.SceneTransforms.worldToWindowCoordinates(
            scene,
            self._position
          )
          windowCoord && self._updateWindowCoord(windowCoord)
        }
      })
    }
  }

  /**
   * 解绑事件（配合基类 `_enableHook()` 的禁用分支，避免监听器泄漏）
   * @private
   */
  _unbindEvent() {
    if (this._removePostRender) {
      this._removePostRender()
      this._removePostRender = undefined
    }
  }

  /**
   *
   * @private
   */
  _mountContent() {
    this._wrapper.style.visibility = 'hidden'
  }

  /**
   *
   * @private
   */
  _installHook() {
    /**
     * 注意：`this.enable = true` 会触发基类 `_enableHook()`，
     * 其中**已经**调用了 `_mountContent()` 与 `_bindEvent()`，
     * 因此此处**不能**再显式调用 `_bindEvent()`（旧实现重复调用导致每帧双份回调）。
     */
    this.enable = true
    const self = this
    Object.defineProperty(this._viewer, 'popup', {
      get() {
        return self
      },
    })
  }

  /**
   * 更新弹框的窗口位置
   *
   * 性能修正：不再整体重写 `style.cssText`。
   * 旧实现每帧执行 `this._wrapper.style.cssText = '...'`，会：
   *   1. 解析并替换全部内联样式（而非只改变化的两个属性）；
   *   2. 使该子树样式失效，触发额外的样式重算。
   * 现改为只写 `visibility` 与 `transform` 两个属性（`transform` 走合成层，代价更低）。
   *
   * 同时缓存 wrapper 尺寸：`offsetWidth/offsetHeight` 是**布局读取**，
   * 每帧读取会强制同步重排；宽度在弹框内容不变时无需每帧测量。
   * @param windowCoord
   * @private
   */
  _updateWindowCoord(windowCoord) {
    if (this._wrapperWidth === undefined) {
      this._wrapperWidth = this._wrapper.offsetWidth
      this._wrapperHeight = this._wrapper.offsetHeight
    }
    let x = windowCoord.x - this._wrapperWidth / 2
    let y = windowCoord.y - this._wrapperHeight

    if (this._config.position === 'topleft') {
      x = windowCoord.x - this._wrapperWidth
      y = windowCoord.y - this._wrapperHeight
    } else if (this._config.position === 'topright') {
      x = windowCoord.x
      y = windowCoord.y - this._wrapperHeight
    } else if (this._config.position === 'bottomleft') {
      x = windowCoord.x - this._wrapperWidth
      y = windowCoord.y
    } else if (this._config.position === 'bottomright') {
      x = windowCoord.x
      y = windowCoord.y
    }
    const style = this._wrapper.style
    if (style.visibility !== 'visible') {
      style.visibility = 'visible'
    }
    style.zIndex = '1'
    style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px, 0)`
  }

  /**
   *
   * @private
   */
  _setCustomClass() {
    DomUtil.setClass(this._wrapper, `widget popup ${this._config.customClass}`)
  }

  /**
   * Setting  wrapper
   * @param wrapper
   * @returns {Widget}
   */
  setWrapper(wrapper) {
    if (wrapper && wrapper instanceof Element) {
      this._wrapper = wrapper
      this._invalidateSize()
      DomUtil.addClass(this._wrapper, 'widget popup')
    }
    return this
  }

  /**
   * 设置弹框内容（覆写基类，内容变化后需失效尺寸缓存）
   * @param content
   * @returns {Popup}
   */
  setContent(content) {
    super.setContent(content)
    this._invalidateSize()
    return this
  }

  /**
   *
   * Setting widget position
   * @param {*} position
   *
   */
  setPosition(position) {
    this._position = position
    if (this._wrapper) {
      /**
       * 只写需要的属性，避免整体替换 cssText（与 _updateWindowCoord 保持一致）。
       * 注意：此处**不**失效尺寸缓存 —— 定位是高频调用，尺寸只在内容/类名变化时才需要重测
       * （由 `setContent` / `config` / `setWrapper` 负责失效）。
       */
      this._wrapper.style.visibility = 'visible'
    }
    return this
  }

  /**
   *
   * @param {*} position
   * @param {*} content
   */
  showAt(position, content) {
    this.setPosition(position).setContent(content)
    return this
  }
}

Widget.registerType('popup')

export default Popup
