/**
 * @Author : Caven Chen
 * @Last Modified By : zhangxi119
 * @Last Modified Time : 2026-09-20 16:10:00
 */
import { Cesium } from '../../../libs'
import Overlay from '../Overlay'
import Parse from '../../parse/Parse'
import State from '../../state/State'
import { Transform } from '../../transform'
import { Util } from '../../utils'

/** 纹理密度上限（防极端 DPR 造成纹理过大） */
const MAX_PIXEL_DENSITY = 4

/**
 * 图标预栅格化缓存：`url@宽x高` → **任务 Promise**（结果为 data URL；失败项解析为 `null`，避免重复失败重试）
 *
 * ⚠ 缓存的必须是**任务**而不是"结果占位"：若先写入占位 `null` 再异步填充结果，
 * 同一 tick 内创建的第二、第三个标记（真实场景：一次数据推送批量创建同图标标记）
 * 会命中这个占位而拿到 `null` → **永久停留在原图上**（已实测复现）。
 * 缓存 Promise 后，并发/同 tick 的请求共享同一个任务，人人拿到同一结果，去重仍然成立。
 */
const iconRasterCache = new Map()

/**
 * 规整纹理密度
 * @param {number|boolean} value 密度值（true 视为按 devicePixelRatio）
 * @returns {number} 夹紧后的密度（>=1）
 */
function resolvePixelDensity(value) {
  if (value === true) {
    const ratio =
      typeof window !== 'undefined' ? Number(window.devicePixelRatio) || 1 : 1
    return Math.min(Math.max(ratio, 1), MAX_PIXEL_DENSITY)
  }
  const density = Number(value)
  if (!Number.isFinite(density) || density <= 1) return 1
  return Math.min(density, MAX_PIXEL_DENSITY)
}

/**
 * 把图标栅格化到目标像素尺寸（提升纹理密度，视觉尺寸由 scale 还原）
 *
 * 必要性：Cesium **从不按 `billboard.width/height` 重栅格化图片**，纹理永远来自
 * `<img>` 的固有尺寸；当绘制缓冲区小于屏幕物理像素时（例如按 CSS 像素渲染 + DPR=2），
 * 图标会被画布二次放大而发虚。按目标物理分辨率预栅格化可消除这一层损失。
 *
 * 失败（非浏览器环境 / 跨域污染 / 解码失败）时返回 `null`，调用方保持原图标。
 * @param {string} url 图标地址
 * @param {number} width 目标宽度（物理像素）
 * @param {number} height 目标高度（物理像素）
 * @returns {Promise<string|null>} data URL 或 null
 */
function rasterizeIcon(url, width, height) {
  const w = Math.round(Number(width))
  const h = Math.round(Number(height))
  if (!url || !(w > 0) || !(h > 0) || typeof document === 'undefined') {
    return Promise.resolve(null)
  }
  const key = `${url}@${w}x${h}`
  const cached = iconRasterCache.get(key)
  if (cached) {
    // 命中：进行中的任务与已完成的结果都是同一个 Promise，调用方总能拿到最终结果
    return cached
  }
  const task = new Promise((resolve) => {
    const image = new Image()
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      image.crossOrigin = 'anonymous'
    }
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        // 图标均为透明底；保持默认高质量插值（禁用平滑会让 SVG 曲线出现台阶）
        ctx.drawImage(image, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = url
  })
  // 先入缓存再返回：同 tick 的后续请求复用同一个任务（失败结果为 null 亦被缓存，不重试）
  iconRasterCache.set(key, task)
  return task
}

class CustomBillboard extends Overlay {
  constructor(position, icon) {
    super()
    this._delegate = new Cesium.Entity({ billboard: {} })
    this._position = Parse.parsePosition(position)
    this._icon = icon
    this._size = [32, 32]
    /** 纹理密度（默认 1 = 关闭，行为与既有版本完全一致） */
    this._pixelDensity = 1
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
    /**
     * 换图标后**必须重做一次预栅格化**（密度开启时）
     *
     * 上面写入的是**原始资源**，其固有尺寸通常远小于当前纹理尺寸
     * （例如 82×69 的 PNG 铺到 164×138 的纹理上）—— 若不清算，图标会立刻退回"发虚"状态，
     * 密度换算的收益被抹掉。使用方的真实路径：无人机按风险等级换色、设备上/下线换图标。
     *
     * 密度 ≤ 1 时 `_upgradeIcon()` 自身早退（零行为变化），栅格化结果按「url + 尺寸」缓存，
     * 反复切换已用过的图标不会重复光栅化。
     */
    this._upgradeIcon()
  }

  get icon() {
    return this._icon
  }

  set size(size) {
    if (!Array.isArray(size)) {
      throw new Error('CustomBillboard: the size invalid')
    }
    this._size = size
    this._applySize()
  }

  get size() {
    return this._size
  }

  /**
   * 纹理密度（**默认 1 = 关闭**，保持既有行为）
   *
   * 开启后（如 `billboard.pixelDensity = true` / `= 2`）：
   * - `width/height` 放大 density 倍（提升纹理密度）；
   * - 同时把 `billboard.scale` 设为 `1/density`（**视觉尺寸逐像素不变**）；
   * - 并对图标做**按目标物理分辨率预栅格化**（见 `rasterizeIcon`）。
   *
   * 适用场景：绘制缓冲区小于屏幕物理像素（如按 CSS 像素渲染 + DPR=2）时，图标不会被二次放大而发虚。
   * 代价：单张图标纹理像素量按 density² 增长（通常 80×60 → 160×120，量级很小）。
   * @param {number|boolean} value 密度值（true = 按 devicePixelRatio），<=1 表示关闭
   */
  set pixelDensity(value) {
    this._pixelDensity = resolvePixelDensity(value)
    this._applySize()
    this._upgradeIcon()
  }

  get pixelDensity() {
    return this._pixelDensity
  }

  /**
   * 按当前密度写入纹理尺寸与缩放（视觉尺寸恒等于 `_size`）
   * @private
   */
  _applySize() {
    if (!this._delegate?.billboard || !this._size) return
    const density = this._pixelDensity || 1
    const width = this._size[0] || 32
    const height = this._size[1] || 32
    this._delegate.billboard.width = width * density
    this._delegate.billboard.height = height * density
    this._delegate.billboard.scale = 1 / density
  }

  /**
   * 按「视觉尺寸 × 密度」把图标替换为预栅格化的高清版本
   *
   * 时序：**必须在挂载之后**调用（`_mountedHook` 会把 `_icon` 写回 billboard.image），
   * 否则高清图标会被原图覆盖。密度为 1 时完全不做任何事（零行为变化）。
   * @private
   */
  _upgradeIcon() {
    const density = this._pixelDensity || 1
    if (density <= 1 || !this._delegate?.billboard || !this._size) return
    const url = this._icon
    const targetWidth = (this._size[0] || 32) * density
    const targetHeight = (this._size[1] || 32) * density
    rasterizeIcon(url, targetWidth, targetHeight).then((dataUrl) => {
      if (!dataUrl || !this._delegate?.billboard) return
      this._delegate.billboard.image = dataUrl
    })
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
    /**
     * 密度相关的纹理尺寸/缩放与图标预栅格化必须在挂载后**再执行一次**
     * （`icon`/`size` 的 setter 会把它们写回原始值）
     */
    if ((this._pixelDensity || 1) > 1) {
      this._applySize()
      this._upgradeIcon()
    }
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
    /**
     * 密度开启时兜底重写缩放：`setStyle` 合入的是 `width/height` 之外的属性，
     * 若调用方未显式传 `scale`，需要把 `1/density` 重新写回，避免视觉尺寸被撑大。
     */
    if ((this._pixelDensity || 1) > 1 && style['scale'] == null) {
      this._applySize()
    }
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
