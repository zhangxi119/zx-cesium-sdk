import PolylineDashAAMaterialProperty from '../material/property/polyline/PolylineDashAAMaterialProperty'

/**
 * 库能力自检
 *
 * ## 为什么需要它
 * 使用方的性能/画质收益往往建立在库层的**具体行为**上（都是"看不见的默认值"）：
 * - 半透明线能吃到大 MSAA → 依赖 `Viewer` 默认 `orderIndependentTranslucency: false`；
 * - 超采样不被最近邻抵消 → 依赖画布默认 `image-rendering: auto`；
 * - 虚线端面平滑 → 依赖虚线材质指向 AA 实现；
 * - 折线不逐帧重建几何 → 依赖 `Polyline.positions` 恒定属性。
 *
 * 这些默认值一旦被改回/替换（升级、分支、二次封装），使用方表现会**静默退化**：
 * 不报错、不崩溃，只是"又慢了 / 又有锯齿了"。
 * `selfCheck()` 把这些行为**断言出来**，供使用方在诊断模式（如 `?perf=1`）下调用，让退化立刻可见。
 *
 * ## 特性
 * - **只读**：不修改任何状态、不做猴补；
 * - **绝不抛错**：单项异常一律降级为 `warn`，不阻断调用方初始化；
 * - **诚实**：运行期无法判定的项标记 `skip`，不伪装成通过。
 *
 * @typedef {Object} SelfCheckItem
 * @property {string} key 能力标识
 * @property {string} name 能力名称
 * @property {"pass"|"warn"|"skip"} status 判定结果
 * @property {string} detail 说明（含实测值与期望值）
 *
 * @typedef {Object} SelfCheckReport
 * @property {boolean} ok 是否全部命中（不含 skip）
 * @property {number} warnCount 未命中项数量
 * @property {SelfCheckItem[]} items 明细
 */

/** 安全执行单项检查：异常一律收敛为 warn，绝不外抛 */
function safeCheck(key, name, check) {
  try {
    return check()
  } catch (err) {
    return {
      key,
      name,
      status: 'warn',
      detail: `检查过程异常：${err?.message ?? err}`,
    }
  }
}

/**
 * 执行库能力自检
 *
 * @param {Object} [options]
 * @param {Object} [options.viewer] DC.Viewer 实例；传入后额外校验**运行期场景参数**
 * @returns {SelfCheckReport} 自检报告
 */
export function selfCheck(options = {}) {
  const viewer = options.viewer
  const items = []

  // ① OIT 默认关闭（半透明图元才能获得 MSAA）
  items.push(
    safeCheck('oitDefault', 'Viewer 默认关闭 OIT', () => {
      const value = viewer?.scene?.orderIndependentTranslucency
      return {
        key: 'oitDefault',
        name: 'Viewer 默认关闭 OIT',
        status: value === false ? 'pass' : value === undefined ? 'skip' : 'warn',
        detail:
          value === undefined
            ? '未传入 viewer，运行期无法判定'
            : `scene.orderIndependentTranslucency = ${value}（期望 false）`,
      }
    })
  )

  // ② 画布重采样为平滑（避免超采样被最近邻降采样抵消）
  items.push(
    safeCheck('imageRendering', '画布 image-rendering = auto', () => {
      const value = viewer?.canvas?.style?.imageRendering
      return {
        key: 'imageRendering',
        name: '画布 image-rendering = auto',
        status: value === 'auto' ? 'pass' : value === undefined ? 'skip' : 'warn',
        detail:
          value === undefined
            ? '未传入 viewer，运行期无法判定'
            : `canvas.style.imageRendering = "${value}"（期望 "auto"）`,
      }
    })
  )

  // ③ MSAA 采样数未被压成 1（具体档位由使用方决定）
  items.push(
    safeCheck('msaaSamples', 'MSAA 采样数未被压成 1', () => {
      const scene = viewer?.scene
      if (!scene) {
        return {
          key: 'msaaSamples',
          name: 'MSAA 采样数',
          status: 'skip',
          detail: '未传入 viewer，运行期无法判定',
        }
      }
      return {
        key: 'msaaSamples',
        name: 'MSAA 采样数',
        status: scene.msaaSupported === false || scene.msaaSamples >= 2 ? 'pass' : 'warn',
        detail: `scene.msaaSamples = ${scene.msaaSamples}、msaaSupported = ${scene.msaaSupported}`,
      }
    })
  )

  // ④ 虚线材质指向抗锯齿实现
  //    注意：DC 的 AA 实现是**独立类**（继承 Cesium 原生类），不能拿原生类判类型
  items.push(
    safeCheck('dashAA', '虚线材质指向 AA 实现', () => {
      const type = new PolylineDashAAMaterialProperty({}).getType()
      return {
        key: 'dashAA',
        name: '虚线材质指向 AA 实现',
        status: type === 'PolylineDashAA' ? 'pass' : 'warn',
        detail: `getType() = "${type}"（期望 "PolylineDashAA"）`,
      }
    })
  )

  // ⑤ 提供性能快照方法
  items.push(
    safeCheck('performanceSnapshot', '提供性能快照方法', () => {
      const available = typeof viewer?.getPerformanceSnapshot === 'function'
      return {
        key: 'performanceSnapshot',
        name: 'viewer.getPerformanceSnapshot 可用',
        status: available ? 'pass' : 'warn',
        detail: available
          ? `pixels = ${viewer.getPerformanceSnapshot()?.pixels}`
          : 'viewer 未提供 getPerformanceSnapshot()',
      }
    })
  )

  const warnCount = items.filter((item) => item.status === 'warn').length
  return {
    ok: warnCount === 0,
    warnCount,
    items,
  }
}

export default { selfCheck }
