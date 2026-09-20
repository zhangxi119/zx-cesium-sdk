import State from '../state/State'
import WidgetType from './WidgetType'

/**
 * 控件类型直查表（小写原名 → 类型值）
 * 性能优化：避免 `getWidgetType` 每次做 locale 大小写转换
 */
const WIDGET_TYPE_MAP = Object.create(null)

class Widget {
  constructor() {
    this._viewer = undefined
    this._enable = false
    this._wrapper = undefined
    this._ready = false
  }

  set enable(enable) {
    if (this._enable === enable) {
      return
    }
    this._enable = enable
    this._state = this._enable ? State.ENABLED : State.DISABLED
    this._enableHook && this._enableHook()
  }

  get enable() {
    return this._enable
  }

  get state() {
    return this._state
  }

  /**
   * mount content
   * @private
   */
  _mountContent() {}

  /**
   * binds event
   * @private
   */
  _bindEvent() {}

  /**
   * Unbinds event
   * @private
   */
  _unbindEvent() {}

  /**
   * When enable modifies the hook executed, the subclass copies it as required
   * @private
   */
  _enableHook() {
    !this._ready && this._mountContent()
    if (this._enable) {
      !this._wrapper.parentNode &&
        this._viewer.widgetContainer.appendChild(this._wrapper)
      this._bindEvent()
    } else {
      this._unbindEvent()
      this._wrapper.parentNode &&
        this._viewer.widgetContainer.removeChild(this._wrapper)
    }
  }

  /**
   * Updating the Widget location requires subclass overrides
   * @param windowCoord
   * @private
   */
  _updateWindowCoord(windowCoord) {}

  /**
   * Hook for installed
   * @private
   */
  _installHook() {}

  /**
   *
   * @returns
   */
  _getViewerOffset() {
    if (!this._viewer) {
      return { x: 0, y: 0 }
    }
    return this._viewer.getOffset()
  }

  /**
   * Installs to viewer
   * @param viewer
   */
  install(viewer) {
    this._viewer = viewer
    /**
     * do installHook
     */
    this._installHook && this._installHook()
    this._state = State.INSTALLED
  }

  /**
   * Setting  wrapper
   * @param wrapper
   * @returns {Widget}
   */
  setWrapper(wrapper) {
    return this
  }

  /**
   * Setting widget content
   * @param content
   * @returns {Widget}
   */
  setContent(content) {
    if (content && typeof content === 'string') {
      this._wrapper.innerHTML = content
    } else if (content && content instanceof Element) {
      while (this._wrapper.hasChildNodes()) {
        this._wrapper.removeChild(this._wrapper.firstChild)
      }
      this._wrapper.appendChild(content)
    }
    return this
  }

  /**
   * hide widget
   */
  hide() {
    this._wrapper &&
      (this._wrapper.style.cssText = `
    visibility:hidden;
    `)
  }

  /**
   * 注册类型（同时维护小写直查表）
   * @param type
   */
  static registerType(type) {
    if (type) {
      const lower = type.toLowerCase()
      WidgetType[type.toUpperCase()] = lower
      WIDGET_TYPE_MAP[lower] = lower
    }
  }

  /**
   * 获取类型值
   * @param type
   */
  static getWidgetType(type) {
    return WIDGET_TYPE_MAP[type] || undefined
  }
}

export default Widget
