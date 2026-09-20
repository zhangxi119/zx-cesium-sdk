import { Cesium } from '../../libs'
import { Util } from '../utils'
import State from '../state/State'
import { LayerEventType, OverlayEventType, LayerEvent } from '../event'
import LayerType from './LayerType'

/**
 * 图层类型直查表（小写原名 → 类型值）
 * 性能优化：`Layer.getLayerType()` 位于 `type` getter 内，被 Viewer 的图层索引逻辑反复调用；
 * 预建直查表后不再执行 locale 大小写转换。
 */
const LAYER_TYPE_MAP = Object.create(null)

class Layer {
  constructor(id) {
    this._id = Util.uuid()
    this._bid = id || Util.uuid()
    this._delegate = undefined
    this._viewer = undefined
    this._state = undefined
    this._show = true
    this._isGround = false
    /**
     * 覆盖物缓存：`{ [overlayId]: Overlay }`
     *
     * 说明：**保持普通对象**而非改用 `Map` —— 多个子类
     * （`VectorLayer` / `HtmlLayer` / `ClusterLayer` / `DynamicLayer` /
     * `GroundPrimitiveLayer` / `I3SLayer` / `PrimitiveLayer` / `TilesetLayer`）
     * 在 `clear()` 中会直接 `this._cache = {}` 替换容器，
     * 若改为 `Map` 将波及这些子类并引入回归风险，收益不成比例。
     */
    this._cache = {}
    /**
     * 业务 id → 覆盖物 索引（`Map<bid, Overlay>`）
     *
     * `getOverlayById(id)` 旧实现是 O(n) 线性扫描（且先 `Object.keys()` 分配键数组），
     * 而它在「按业务 id 查找区域/线体」路径上被反复调用。维护该索引后降为 O(1)。
     */
    this._bidIndex = new Map()
    /** 建立索引时所依据的 `_cache` 容器引用（用于探测子类整体替换容器的情况） */
    this._bidIndexSource = undefined
    this._attr = {}
    this._layerEvent = new LayerEvent()
    this._layerEvent.on(LayerEventType.ADD, this._onAdd, this)
    this._layerEvent.on(LayerEventType.REMOVE, this._onRemove, this)
  }

  get layerId() {
    return this._id
  }

  get id() {
    return this._bid
  }

  get delegate() {
    return this._delegate
  }

  get viewer() {
    return this._viewer
  }

  set show(show) {
    this._show = show
    this._delegate && (this._delegate.show = this._show)
  }

  get show() {
    return this._show
  }

  get layerEvent() {
    return this._layerEvent
  }

  set attr(attr) {
    this._attr = attr
  }

  get attr() {
    return this._attr
  }

  get state() {
    return this._state
  }

  /**
   * The hook for added
   * @private
   */
  _addedHook() {}

  /**
   * The hook for removed
   * @private
   */
  _removedHook() {}

  /**
   * The layer added callback function
   * Subclasses need to be overridden
   * @param viewer
   * @private
   */
  _onAdd(viewer) {
    this._viewer = viewer
    if (!this._delegate) {
      return
    }
    if (this._delegate instanceof Cesium.PrimitiveCollection) {
      if (this._isGround) {
        this._viewer.scene.groundPrimitives.add(this._delegate)
      } else {
        this._viewer.scene.primitives.add(this._delegate)
      }
    } else if (this._delegate instanceof Cesium.ImageryLayer) {
      this._viewer.imageryLayers.add(this._delegate)
    } else {
      this._viewer.dataSources.add(this._delegate)
    }
    this._addedHook && this._addedHook()
    this._state = State.ADDED
  }

  /**
   * The layer added callback function
   * Subclasses need to be overridden
   * @private
   */
  _onRemove() {
    if (!this._delegate) {
      return
    }
    if (this._viewer) {
      /**
       * 清空覆盖物容器与业务 id 索引
       *
       * 注意：`_cache` 为**普通对象**（未改用 Map —— 多个子类在 clear() 中会整体替换它，
       * 改 Map 会波及子类），因此这里必须**整体替换**而非调用 `clear()`；
       * 同时清空 `_bidIndex` 并把 `_bidIndexSource` 置为失效，
       * 避免索引残留已移除的覆盖物。
       */
      this._cache = {}
      this._bidIndex.clear()
      this._bidIndexSource = undefined
      if (this._delegate instanceof Cesium.PrimitiveCollection) {
        this._delegate.removeAll()
        if (this._isGround) {
          this._viewer.scene.groundPrimitives.remove(this._delegate)
        } else {
          this._viewer.scene.primitives.remove(this._delegate)
        }
      } else if (this._delegate instanceof Cesium.ImageryLayer) {
        this._viewer.imageryLayers.remove(this._delegate, false)
      } else if (this._delegate instanceof Promise) {
        this._delegate.then((dataSource) => {
          dataSource.entities.removeAll()
        })
        this._viewer.dataSources.remove(this._delegate)
      } else {
        this._delegate.entities && this._delegate.entities.removeAll()
        this._viewer.dataSources.remove(this._delegate)
      }
      this._removedHook && this._removedHook()
      this._state = State.REMOVED
    }
  }

  /**
   * The layer add overlay
   * @param overlay
   * @private
   */
  _addOverlay(overlay) {
    // eslint-disable-next-line no-prototype-builtins
    if (this._cache.hasOwnProperty(overlay.overlayId)) {
      return
    }
    this._cache[overlay.overlayId] = overlay
    /**
     * 同步维护业务 id 索引，使 getOverlayById 为 O(1)
     */
    if (overlay.id !== undefined && overlay.id !== null) {
      this._bidIndex.set(overlay.id, overlay)
    }
    this._delegate && overlay.fire(OverlayEventType.ADD, this)
    if (this._state === State.CLEARED) {
      this._state = State.ADDED
    }
  }

  /**
   * The layer remove overlay
   * @param overlay
   * @private
   */
  _removeOverlay(overlay) {
    // eslint-disable-next-line no-prototype-builtins
    if (!this._cache.hasOwnProperty(overlay.overlayId)) {
      return
    }
    this._delegate && overlay.fire(OverlayEventType.REMOVE, this)
    delete this._cache[overlay.overlayId]
    /**
     * 仅当索引确实指向该覆盖物时才删除，避免同 id 覆盖时误删新条目
     */
    if (this._bidIndex.get(overlay.id) === overlay) {
      this._bidIndex.delete(overlay.id)
    }
  }

  /**
   * Add overlay
   * @param overlay
   * @returns {Layer}
   */
  addOverlay(overlay) {
    this._addOverlay(overlay)
    return this
  }

  /**
   * Add overlays
   * @param overlays
   * @returns {Layer}
   */
  addOverlays(overlays) {
    if (Array.isArray(overlays)) {
      overlays.forEach((item) => {
        this._addOverlay(item)
      })
    }
    return this
  }

  /**
   * Remove overlay
   * @param overlay
   * @returns {Layer}
   */
  removeOverlay(overlay) {
    this._removeOverlay(overlay)
    return this
  }

  /**
   * Returns the overlay by overlayId
   * @param overlayId
   * @returns {*|undefined}
   */
  getOverlay(overlayId) {
    return this._cache[overlayId] || undefined
  }

  /**
   * 按业务 id 重建索引
   *
   * 子类在 `clear()` 中会整体替换 `this._cache`（`this._cache = {}`），
   * 直接绕过 `_removeOverlay`；因此这里以「容器引用是否变化」作为失效信号，
   * 保证索引不会残留已被清除的覆盖物。
   * @private
   */
  _rebuildBidIndex() {
    this._bidIndex.clear()
    this._bidIndexSource = this._cache
    const keys = Object.keys(this._cache)
    for (let i = 0, n = keys.length; i < n; i++) {
      const overlay = this._cache[keys[i]]
      if (overlay && overlay.id !== undefined && overlay.id !== null) {
        this._bidIndex.set(overlay.id, overlay)
      }
    }
  }

  /**
   * Returns the overlay by bid
   *
   * 【性能修正】由 O(n) 线性扫描改为 O(1) 索引查找
   * @param id
   * @returns {any}
   */
  getOverlayById(id) {
    if (id === undefined || id === null) {
      return undefined
    }
    /**
     * 容器被整体替换（子类 clear）时索引失效，需重建
     */
    if (this._bidIndexSource !== this._cache) {
      this._rebuildBidIndex()
    }
    let hit = this._bidIndex.get(id)
    if (hit) {
      return hit
    }
    /**
     * 兜底：索引未命中（例如外部直接往 `_cache` 写入了新条目）时重建一次再查，
     * 保证行为与旧的线性扫描完全一致
     */
    this._rebuildBidIndex()
    return this._bidIndex.get(id) || undefined
  }

  /**
   * Returns the overlays by attrName and AttrVal
   * @param attrName
   * @param attrVal
   * @returns {[]}
   */
  getOverlaysByAttr(attrName, attrVal) {
    let result = []
    this.eachOverlay((item) => {
      if (item.attr[attrName] === attrVal) {
        result.push(item)
      }
    }, this)
    return result
  }

  /**
   * Iterate through each overlay and pass it as an argument to the callback function
   *
   * 说明：改用索引循环 + 直接取键，避免 `Array.prototype.forEach` 的闭包调用开销
   * （本方法在 `HtmlLayer` 中位于 `postRender` 内，属逐帧路径）
   * @param method
   * @param context
   * @returns {Layer}
   */
  eachOverlay(method, context) {
    if (method) {
      const ctx = context || this
      const keys = Object.keys(this._cache)
      for (let i = 0, n = keys.length; i < n; i++) {
        method.call(ctx, this._cache[keys[i]])
      }
    }
    return this
  }

  /**
   * Returns all overlays
   *
   * 说明：返回值仍为**新数组**（调用方可能持有/排序），改用索引循环避免闭包开销
   * @returns {[]}
   */
  getOverlays() {
    const keys = Object.keys(this._cache)
    const result = new Array(keys.length)
    for (let i = 0, n = keys.length; i < n; i++) {
      result[i] = this._cache[keys[i]]
    }
    return result
  }

  /**
   * Clears all overlays
   * Subclasses need to be overridden
   */
  clear() {}

  /**
   * Removes from the viewer
   */
  remove() {
    if (this._viewer) {
      this._viewer.removeLayer(this)
    }
  }

  /**
   * Adds to the viewer
   * @param viewer
   * @returns {Layer}
   */
  addTo(viewer) {
    if (viewer?.addLayer) {
      viewer.addLayer(this)
    }
    return this
  }

  /**
   * sets the style, the style will apply to every overlay of the layer
   * Subclasses need to be overridden
   * @param style
   */
  setStyle(style) {}

  /**
   * Subscribe event
   * @param type
   * @param callback
   * @param context
   * @returns {Layer}
   */
  on(type, callback, context) {
    this._layerEvent.on(type, callback, context || this)
    return this
  }

  /**
   * Unsubscribe event
   * @param type
   * @param callback
   * @param context
   * @returns {Layer}
   */
  off(type, callback, context) {
    this._layerEvent.off(type, callback, context || this)
    return this
  }

  /**
   * Trigger subscription event
   * @param type
   * @param params
   * @returns {Layer}
   */
  fire(type, params) {
    this._layerEvent.fire(type, params)
    return this
  }

  /**
   * 注册图层类型
   * 同时维护小写直查表，避免 `getLayerType` 每次做 locale 大小写转换
   * @param type
   */
  static registerType(type) {
    if (type) {
      const lower = type.toLowerCase()
      LayerType[type.toUpperCase()] = lower
      LAYER_TYPE_MAP[lower] = lower
    }
  }

  /**
   * Returns type
   * @param type
   * @returns {*|undefined}
   */
  static getLayerType(type) {
    return LAYER_TYPE_MAP[type] || undefined
  }
}

export default Layer
