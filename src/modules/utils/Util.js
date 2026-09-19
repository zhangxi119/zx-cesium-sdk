/**
 * @Author: Caven
 * @Date: 2019-12-31 17:58:01
 * @Last Modified By : zhangxi119
 * @Last Modified Time : 2026-09-19 18:20:00
 */

/**
 * uuid 自增序号（配合随机后缀，兼顾唯一性与性能）
 */
let uuidSeed = 0

/**
 *  Some of the code borrows from leaflet
 * https://github.com/Leaflet/Leaflet/tree/master/src/core
 */
class Util {
  /**
   * Generates uuid
   *
   * 性能优化：旧实现每次都要创建一个 36 元素（含 4 个空洞）的数组并 `join('')`，
   * 而 `Overlay` / `Layer` 的构造函数各调用两次 —— 批量创建设备/覆盖物时开销可观。
   * 现改为「自增序号 + 随机后缀」，保留 `D-` 前缀与短横线分段的可读风格。
   * @param prefix
   * @returns {string}
   */
  static uuid(prefix = 'D') {
    uuidSeed = (uuidSeed + 1) % 0xffffff
    const seed = uuidSeed.toString(16).padStart(6, '0')
    const rand = (Math.random() * 0xffffff) | 0
    return `${prefix}-${seed}-${rand.toString(16).padStart(6, '0')}`
  }

  /**
   * Merges the properties of the `src` object (or multiple objects) into `dest` object and returns the latter.
   *
   * 性能优化：旧实现用 `for...in` 遍历（会走原型链，是 V8 中最慢的迭代形式）。
   * 现改为 `Object.keys` + 索引循环，只拷贝自有属性
   * （DC 内部所有调用点的源对象均为字面量/配置对象，语义无差异）。
   * @param dest
   * @param sources
   * @returns {*}
   */
  static merge(dest, ...sources) {
    for (let j = 0, len = sources.length; j < len; j++) {
      const src = sources[j]
      if (!src) {
        continue
      }
      const keys = Object.keys(src)
      for (let i = 0, n = keys.length; i < n; i++) {
        const key = keys[i]
        dest[key] = src[key]
      }
    }
    return dest
  }

  /**
   * @function splitWords(str: String): String[]
   * Trims and splits the string on whitespace and returns the array of parts.
   * @param {*} str
   */
  static splitWords(str) {
    return this.trim(str).split(/\s+/)
  }

  /**
   * @function setOptions(obj: Object, options: Object): Object
   * Merges the given properties to the `options` of the `obj` object, returning the resulting options. See `Class options`.
   * @param {*} obj
   * @param {*} options
   */
  static setOptions(obj, options) {
    if (!obj.hasOwnProperty('options')) {
      obj.options = obj.options ? Object.create(obj.options) : {}
    }
    for (let i in options) {
      obj.options[i] = options[i]
    }
    return obj.options
  }

  /**
   *  @function formatNum(num: Number, digits?: Number): Number
   *  Returns the number `num` rounded to `digits` decimals, or to 6 decimals by default.
   * @param num
   * @param digits
   * @returns {number}
   */
  static formatNum(num, digits) {
    let pow = Math.pow(10, digits === undefined ? 6 : digits)
    return Math.round(num * pow) / pow
  }

  /**
   * @function trim(str: String): String
   * Compatibility polyfill for [String.prototype.trim](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/Trim)
   * @param {*} str
   */
  static trim(str) {
    return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '')
  }

  /**
   *  Data URI string containing a base64-encoded empty GIF image.
   * Used as a hack to free memory from unused images on WebKit-powered
   * mobile devices (by setting image `src` to this string).
   * @returns {string}
   */
  static emptyImageUrl() {
    return (function () {
      return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
    })()
  }

  /**
   * @function checkPosition(position: Object): Boolean
   * Check position for validity
   * @param {*} position
   */
  static checkPosition(position) {
    return (
      position &&
      position.hasOwnProperty('_lng') &&
      position.hasOwnProperty('_lat') &&
      position.hasOwnProperty('_alt')
    )
  }

  /**
   * Creates a debounced function that delays invoking `fn` until after `delay`
   * @param fn
   * @param delay
   * @returns {function(): void}
   */
  static debounce(fn, delay) {
    let timer = null
    return function () {
      timer && clearTimeout(timer)
      timer = setTimeout(fn, delay)
    }
  }

  /**
   * Creates a throttled function that only invokes `fn` at most once per
   * @param fn
   * @param delay
   * @returns {function(): void}
   */
  static throttle(fn, delay) {
    let valid = true
    return function () {
      if (!valid) {
        return false
      }
      valid = false
      setTimeout(() => {
        fn()
        valid = true
      }, delay)
    }
  }

  /**
   *
   * @param dataUrl
   * @returns {Blob}
   */
  static dataURLtoBlob(dataUrl) {
    let arr = dataUrl.split(',')
    let mime = arr[0].match(/:(.*?);/)[1]
    let bStr = atob(arr[1])
    let len = bStr.length
    let u8Arr = new Uint8Array(len)
    while (len--) {
      u8Arr[len] = bStr.charCodeAt(len)
    }
    return new Blob([u8Arr], { type: mime })
  }

  /**
   * 判断是否为 Promise（或 thenable）
   *
   * 性能优化：旧实现为 `Promise.resolve(obj) == obj`，对**非 Promise 也会分配一个 Promise 对象**，
   * 且使用了宽松相等。本方法位于 `Overlay.show` setter 中，
   * 在「按区域批量显隐」等场景下会被按覆盖物数量反复调用。
   * 现改为特征判断（零分配），语义等价：原生 Promise 与 thenable 均返回 true。
   * @param {*} obj
   * @returns {boolean}
   */
  static isPromise(obj) {
    return (
      obj != null &&
      (obj instanceof Promise || typeof obj.then === 'function')
    )
  }

  /**
   * 取 `JulianDate` 对应的「累计秒数」（自儒略日起算，单调递增）
   *
   * 用于**基于时间**的动画计算（如圆环旋转），以保证角速度与帧率无关。
   *
   * 实现说明：
   *  - Cesium 的 `JulianDate` **没有静态** `secondsOfDay`，只有实例 getter
   *    `julianDate.secondsOfDay`（当日秒数，0~86400，跨日会归零）；
   *  - 若直接使用 `secondsOfDay`，动画会在每天零点发生跳变；
   *  - 因此这里用 `dayNumber * 86400 + secondsOfDay` 得到单调累计秒数，
   *    且不产生任何对象分配。
   * @param {Cesium.JulianDate} julianDate
   * @returns {number} 累计秒数；入参无效时返回 0
   */
  static getElapsedSeconds(julianDate) {
    if (!julianDate) {
      return 0
    }
    return julianDate.dayNumber * 86400 + julianDate.secondsOfDay
  }
}

export default Util
