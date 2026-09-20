/**
 * @Author : zhangxi119
 * @Last Modified By : zhangxi119
 * @Last Modified Time : 2026-09-20 22:30:00
 */

/**
 * 节流工具
 *
 * ## 为什么库层需要它
 * 地图实体（无人机 / 设备 / 车辆）的实时位置属于**状态型数据**：推送持续变化，且最终值必须落到地图上。
 * 而 `Util.throttle` 是「到点前直接丢弃」的实现（见 `Util.js`），会**丢掉最后一次更新**，导致：
 * - 推送停止后实体停在倒数第 N 个位置（终点偏差）；
 * - 地图与列表 / store 显示的位置不一致。
 *
 * `Util.throttle` 也没有「按 key 独立计时」能力，多目标场景下互相挤占窗口。
 *
 * 因此这里提供两个语义清晰的节流器：
 * - `IntervalGate`：**采样型**节流（丢中间帧即可，如轨迹点记录）；
 * - `TrailingThrottle`：**状态型**节流（按 key 合并为最新值并在窗口结束时补发，**保证末次值一定落地**）。
 *
 * 两者均不依赖 Cesium，可在任意环境（含 Node）使用。
 */

/**
 * 采样型间隔闸门
 *
 * 语义：`interval` 毫秒内只放行一次；首次调用（含 `interval <= 0`）必然放行。
 */
export class IntervalGate {
  /**
   * @param {number} intervalMs 最小间隔（毫秒），<=0 表示不限流
   */
  constructor(intervalMs) {
    this._interval = Math.max(intervalMs || 0, 0)
    this._lastAt = 0
  }

  /** 更新间隔（毫秒） */
  set interval(value) {
    this._interval = Math.max(+value || 0, 0)
  }

  /** 当前间隔（毫秒） */
  get interval() {
    return this._interval
  }

  /**
   * 判断本次是否放行
   * @param {number} [now] 当前时间戳（默认 `Date.now()`）
   * @param {number} [interval] 本次使用的间隔（不传则用构造值）
   * @returns {boolean} true = 放行并记账；false = 丢弃
   */
  allow(now = Date.now(), interval = this._interval) {
    if (interval <= 0) {
      this._lastAt = now
      return true
    }
    // 首次调用（_lastAt = 0）必然放行，保证首帧立即生效
    if (this._lastAt && now - this._lastAt < interval) return false
    this._lastAt = now
    return true
  }

  /** 复位（清空记账，下次调用立即放行） */
  reset() {
    this._lastAt = 0
  }
}

/**
 * 状态型节流器（**尾帧保证**）
 *
 * 语义：同一 key 的连续 `push` 在一个节流窗口内只会立即执行第一次，
 * 窗口内的后续值被合并为「最新值」，并在窗口结束时补发一次。
 * 因此最终一定收敛到**最后一次推送的值**，不会出现终点偏差。
 */
export class TrailingThrottle {
  /**
   * @param {number} intervalMs 节流窗口（毫秒），<=0 表示退化为直通
   * @param {(key: string, payload: any) => void} apply 实际执行更新的回调
   */
  constructor(intervalMs, apply) {
    this._interval = Math.max(intervalMs || 0, 0)
    this._apply = apply
    /** key → 最近一次执行时间戳 */
    this._lastAt = new Map()
    /** key → 待补发的最新值 */
    this._pending = new Map()
    /** 尾帧补发定时器（合并为单个） */
    this._timer = 0
    /** 是否已销毁 */
    this._destroyed = false
  }

  /** 更新节流窗口（毫秒） */
  set interval(value) {
    this._interval = Math.max(+value || 0, 0)
  }

  /** 当前节流窗口（毫秒） */
  get interval() {
    return this._interval
  }

  /** 待补发数量（诊断用） */
  get pendingCount() {
    return this._pending.size
  }

  /**
   * 推送一次更新
   * @param {string} key 去重键（如实体 id）
   * @param {any} payload 最新值
   * @param {number} [now] 当前时间戳
   */
  push(key, payload, now = Date.now()) {
    if (this._destroyed || key == null) return
    if (this._interval <= 0) {
      this._safeApply(key, payload)
      return
    }
    const last = this._lastAt.get(key) || 0
    if (!last || now - last >= this._interval) {
      this._lastAt.set(key, now)
      this._pending.delete(key)
      this._safeApply(key, payload)
      return
    }
    // 窗口内：合并为最新值，并安排尾帧补发
    this._pending.set(key, payload)
    this._scheduleFlush(last + this._interval)
  }

  /**
   * 立即应用挂起值（不等待窗口结束）
   * @param {string} [key] 指定 key；不传则应用全部挂起项
   */
  flush(key) {
    if (this._destroyed) return
    if (key != null) {
      const payload = this._pending.get(key)
      if (payload === undefined) return
      this._pending.delete(key)
      this._lastAt.set(key, Date.now())
      this._safeApply(key, payload)
      return
    }
    const entries = [...this._pending.entries()]
    this._pending.clear()
    const now = Date.now()
    entries.forEach(([k, payload]) => {
      this._lastAt.set(k, now)
      this._safeApply(k, payload)
    })
  }

  /**
   * 丢弃指定 key 的挂起值（实体已被移除时使用，避免回调访问已销毁对象）
   * @param {string} [key] 指定 key；不传则清空全部
   */
  cancel(key) {
    if (key != null) this._pending.delete(key)
    else this._pending.clear()
  }

  /** 安排尾帧补发（合并为单个定时器，取最早到期时间） */
  _scheduleFlush(at) {
    if (this._timer) return
    const delay = Math.max(at - Date.now(), 0)
    this._timer = setTimeout(() => {
      this._timer = 0
      if (this._destroyed) return
      this.flush()
      // 若 flush 期间又有新的挂起项，继续安排
      if (this._pending.size) this._scheduleFlush(Date.now() + this._interval)
    }, delay)
  }

  /** 执行回调并兜底异常，避免单个实体异常中断整批更新 */
  _safeApply(key, payload) {
    try {
      this._apply?.(key, payload)
    } catch (err) {
      console.warn(`[TrailingThrottle] 更新 ${key} 失败`, err)
    }
  }

  /** 销毁：清理定时器与挂起项 */
  destroy() {
    this._destroyed = true
    clearTimeout(this._timer)
    this._timer = 0
    this._pending.clear()
    this._lastAt.clear()
    this._apply = null
  }
}
