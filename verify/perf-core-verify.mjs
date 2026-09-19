/**
 * DC 库性能优化 —— 核心模块运行时行为验证（源码级）
 *
 * 位置说明：本脚本随仓库提交（`verify/` 未被 .gitignore 忽略），便于任何环境下复现验证结论。
 * 运行：`npm run verify:perf`
 *   （等价于 `node --import ./verify/register.mjs verify/perf-core-verify.mjs`）
 *
 * 与 `perf-verify.mjs` 的分工：
 *  - `perf-verify.mjs`  针对 **构建产物**（dist/index.js）做公共 API 与几何验证；
 *  - 本文件针对 **源码模块** 做内部行为验证（`ViewerOption` / `MouseEvent` / `Popup` /
 *    `ContextMenu` / `Viewer` 图层索引），这些类需要 WebGL 才能完整构造，
 *    因此用 stub viewer 直接驱动其方法，以覆盖「默认值是否正确」「热路径是否真的被省掉」。
 */
import './dom-env.mjs'

const Cesium = await import('cesium')
const { default: ViewerOption } = await import(
  '../src/modules/option/ViewerOption.js'
)
const { default: MouseEvent } = await import(
  '../src/modules/event/type/MouseEvent.js'
)
const { default: Popup } = await import('../src/modules/widget/type/Popup.js')
const { default: ContextMenu } = await import(
  '../src/modules/widget/type/ContextMenu.js'
)
const { default: Viewer } = await import('../src/modules/viewer/Viewer.js')
const { default: VectorLayer } = await import(
  '../src/modules/layer/type/VectorLayer.js'
)

let pass = 0
let fail = 0
function ok(name, cond, extra) {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}${extra !== undefined ? ` → ${extra}` : ''}`)
  }
}
function section(title) {
  console.log(`\n=== ${title} ===`)
}

/** 创建用于 ViewerOption 的 stub viewer */
function createOptionViewer() {
  const scene = {
    msaaSamples: 4, // Cesium 默认
    msaaSupported: true,
    sunBloom: true, // Cesium 默认
    globe: { baseColor: undefined, translucency: {} },
    skyAtmosphere: { show: true },
    sun: { show: true },
    moon: { show: true },
    postProcessStages: { fxaa: { enabled: false } },
    verticalExaggeration: 1,
    verticalExaggerationRelativeHeight: 0,
    screenSpaceCameraController: { maximumZoomDistance: 0 },
    canvas: document.createElement('canvas'),
  }
  return { delegate: { shadows: false, resolutionScale: 1 }, scene }
}

// ------------------------------------------------- G1 ViewerOption 默认值语义
section('G1 · ViewerOption 渲染默认值（运行时行为）')
{
  const viewer = createOptionViewer()
  const option = new ViewerOption(viewer)
  ok(
    '构造期关闭 sunBloom（Cesium 默认为 true）',
    viewer.scene.sunBloom === false,
    viewer.scene.sunBloom
  )
  ok(
    '构造期不触碰 msaaSamples（保留 Cesium 默认 4）',
    viewer.scene.msaaSamples === 4,
    viewer.scene.msaaSamples
  )
  ok(
    '构造期保留 globe.baseColor 的 DC 默认视觉（深蓝）',
    viewer.scene.globe.baseColor !== undefined
  )

  // 关键回归：旧实现 setOptions 会把 msaaSamples 重置为 1
  option.setOptions({ resolutionScale: 1 })
  ok(
    'setOptions({ resolutionScale }) 后 msaaSamples 仍为 4（旧实现会变成 1）',
    viewer.scene.msaaSamples === 4,
    viewer.scene.msaaSamples
  )
  ok('setOptions 正确应用 resolutionScale', viewer.delegate.resolutionScale === 1)

  // 旧实现会重置大气/太阳/月亮
  viewer.scene.skyAtmosphere.show = false
  viewer.scene.sun.show = false
  viewer.scene.moon.show = false
  option.setOptions({ shadows: true })
  ok(
    'setOptions 不重置未传入的 skyAtmosphere.show',
    viewer.scene.skyAtmosphere.show === false
  )
  ok('setOptions 不重置未传入的 sun.show', viewer.scene.sun.show === false)
  ok('setOptions 不重置未传入的 moon.show', viewer.scene.moon.show === false)
  ok('setOptions 正确应用 shadows', viewer.delegate.shadows === true)

  // 显式传入才覆盖
  option.setOptions({ msaaSamples: 1 })
  ok('显式传 msaaSamples:1 才关闭 MSAA', viewer.scene.msaaSamples === 1)
  option.setOptions({ msaaSamples: 4 })
  ok('显式传 msaaSamples:4 可恢复', viewer.scene.msaaSamples === 4)

  ok('未传 showSunBloom 时保持关闭', viewer.scene.sunBloom === false)
  option.setOptions({ showSunBloom: true })
  ok('显式传 showSunBloom:true 可开启', viewer.scene.sunBloom === true)
  option.setOptions({ showSunBloom: false })
  ok('显式传 showSunBloom:false 可关闭', viewer.scene.sunBloom === false)

  // globe 子项同样「只应用传入键」
  viewer.scene.globe.tileCacheSize = 100
  viewer.scene.globe.showSkirts = true
  option.setOptions({ globe: { show: false } })
  ok('globe.show 被应用', viewer.scene.globe.show === false)
  ok(
    'globe.tileCacheSize 未被重置（旧实现会写成 100/覆盖）',
    viewer.scene.globe.tileCacheSize === 100
  )
  ok('globe.showSkirts 未被重置', viewer.scene.globe.showSkirts === true)

  // 空/非法入参
  let threw = false
  try {
    option.setOptions({})
    option.setOptions(undefined)
    option.setOptions(null)
  } catch {
    threw = true
  }
  ok('setOptions 空入参不抛异常', !threw)
}

// ------------------------------------------------- G3 MouseEvent 热路径
section('G3 · MouseEvent 热路径（运行时行为）')
{
  const canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  Object.defineProperty(canvas, 'offsetWidth', { value: 800, configurable: true })
  Object.defineProperty(canvas, 'offsetHeight', { value: 600, configurable: true })

  let rectCalls = 0
  canvas.getBoundingClientRect = () => {
    rectCalls++
    return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }
  }

  let pickPositionCalls = 0
  let pickEllipsoidCalls = 0
  let getLayersCalls = 0
  const viewerEvent = new (await import('../src/modules/event')).ViewerEvent()
  const scene = {
    canvas,
    // 用 2D 模式走 CPU 椭球拾取分支，避免依赖 terrainProvider
    mode: Cesium.SceneMode.SCENE2D,
    pickPositionSupported: true,
    pick: () => undefined,
    pickPosition: () => {
      pickPositionCalls++
      return Cesium.Cartesian3.fromDegrees(116, 39, 0)
    },
    camera: {
      pickEllipsoid: () => {
        pickEllipsoidCalls++
        return Cesium.Cartesian3.fromDegrees(116, 39, 0)
      },
      getPickRay: () => ({ __ray: true }),
    },
    globe: { pick: () => undefined, ellipsoid: Cesium.Ellipsoid.WGS84 },
  }
  const viewer = {
    canvas,
    scene,
    viewerEvent,
    getLayers: () => {
      getLayersCalls++
      return []
    },
  }

  const ev = new MouseEvent(viewer)
  ok('默认不开启 pickPosition（GPU 深度回读）', ev.enableMouseMovePickPosition === false)

  // 1) _adjustPosition 缓存
  rectCalls = 0
  const a1 = ev._adjustPosition({ x: 10, y: 20 })
  const a2 = ev._adjustPosition({ x: 30, y: 40 })
  ok('_adjustPosition 连续调用只读一次布局（缓存生效）', rectCalls === 1, rectCalls)
  ok('_adjustPosition 数值正确（尺寸一致时缩放为 1）', a1.x === 10 && a2.y === 40)

  // 2) _getMouseInfo 只调一次 _adjustPosition
  let adjustCalls = 0
  const originalAdjust = ev._adjustPosition.bind(ev)
  ev._adjustPosition = p => {
    adjustCalls++
    return originalAdjust(p)
  }
  ev._getMouseInfo({ x: 5, y: 6 })
  ok('_getMouseInfo 只调用一次 _adjustPosition（旧实现调两次）', adjustCalls === 1, adjustCalls)

  // 3) mousemove 默认不触发 pickPosition
  pickPositionCalls = 0
  pickEllipsoidCalls = 0
  ev._mouseMoveHandler({ endPosition: { x: 100, y: 100 } })
  ok('mousemove 默认不调用 scene.pickPosition（GPU 回读已消除）', pickPositionCalls === 0, pickPositionCalls)
  ok('mousemove 仍提供 surfacePosition（CPU 椭球拾取）', pickEllipsoidCalls === 1, pickEllipsoidCalls)

  // 4) 显式开启后才走 GPU 回读
  pickPositionCalls = 0
  ev.enableMouseMovePickPosition = true
  ev._mouseMoveHandler({ endPosition: { x: 100, y: 100 } })
  ok('显式开启 enableMouseMovePickPosition 后才调用 pickPosition', pickPositionCalls === 1, pickPositionCalls)
  ev.enableMouseMovePickPosition = false

  // 5) _raiseEvent 订阅者前置短路
  getLayersCalls = 0
  ev._raiseEvent(Cesium.ScreenSpaceEventType.MOUSE_MOVE, { target: undefined })
  ok(
    '无目标且无订阅者时短路：不调用 getLayers（旧实现无条件调用）',
    getLayersCalls === 0,
    getLayersCalls
  )

  let viewerHits = 0
  viewerEvent.on(Cesium.ScreenSpaceEventType.MOUSE_MOVE, () => {
    viewerHits++
  })
  getLayersCalls = 0
  ev._raiseEvent(Cesium.ScreenSpaceEventType.MOUSE_MOVE, { target: undefined })
  ok('viewer 有订阅者时不再短路（会构造 targetInfo）', getLayersCalls === 1, getLayersCalls)
  ok('viewer 订阅者被正常派发', viewerHits === 1, viewerHits)

  // 6) 只为实际派发的事件类型注册动作
  const registered = Object.keys(ev._cache).map(k => Number(k))
  ok('事件缓存不含 PINCH_*（DC 从不派发）', !registered.includes(Cesium.ScreenSpaceEventType.PINCH_START))
  ok('事件缓存不含 MIDDLE_*（DC 从不派发）', !registered.includes(Cesium.ScreenSpaceEventType.MIDDLE_DOWN))
  ok(
    '事件缓存包含 MOUSE_MOVE',
    registered.includes(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  )
  ev._registerEvent && ev._handler && ev._handler.destroy && ev._handler.destroy()
}

// ------------------------------------------------- G3 Viewer 图层索引
section('G3 · Viewer 图层索引（运行时行为）')
{
  // Viewer 构造需要 WebGL，这里用原型实例注入内部状态直接验证索引逻辑
  const v = Object.create(Viewer.prototype)
  v._layerCache = {}
  v._layersFlat = []
  v._layerIndex = new Map()
  v._layerGroupCache = {}
  /**
   * `Layer._onAdd` 会调用 `viewer.dataSources.add(...)`，
   * 而 `Viewer.dataSources` 是只读 getter（ESM 严格模式下不可直接赋值），
   * 因此用 defineProperty 定义自有属性来遮蔽它。
   */
  Object.defineProperty(v, 'dataSources', {
    value: { add: () => {}, remove: () => {} },
    configurable: true,
  })

  const l1 = new VectorLayer('L1')
  const l2 = new VectorLayer('L2')

  v._addLayer(l1)
  v._addLayer(l2)
  ok('getLayers 返回 2 项', v.getLayers().length === 2)
  ok('getLayer(id) O(1) 命中 L1', v.getLayer('L1') === l1)
  ok('getLayer(id) 命中 L2', v.getLayer('L2') === l2)
  ok('hasLayer 命中', v.hasLayer(l1) === true)
  ok('getLayer 未命中返回 undefined', v.getLayer('L9') === undefined)

  const visited = []
  v.eachLayer(l => visited.push(l.id))
  ok('eachLayer 遍历 2 项', visited.length === 2, visited.join(','))

  // getLayers 返回副本，外部修改不影响内部
  const copy = v.getLayers()
  copy.push('x')
  ok('getLayers 返回副本（外部修改不污染内部缓存）', v.getLayers().length === 2)

  // 重复添加幂等
  v._addLayer(l1)
  ok('重复 _addLayer 幂等', v.getLayers().length === 2)
  ok('重复添加后索引仍指向原对象', v.getLayer('L1') === l1)

  v._removeLayer(l1)
  ok('移除后 getLayers 为 1 项', v.getLayers().length === 1)
  ok('移除后 getLayer 返回 undefined', v.getLayer('L1') === undefined)
  ok('移除后 hasLayer 为 false', v.hasLayer(l1) === false)
  ok('移除后另一图层仍在', v.getLayer('L2') === l2)
}

// ------------------------------------------------- G1 Popup 监听唯一性
section('G1 · Popup postRender 监听唯一性（运行时行为）')
{
  const canvas = document.createElement('canvas')
  const postRender = new Cesium.Event()
  const viewer = {
    canvas,
    scene: { postRender },
    widgetContainer: document.createElement('div'),
  }
  const popup = new Popup()
  popup.install(viewer)

  ok(
    '安装后 postRender 监听数为 1（旧实现重复注册为 2）',
    postRender.numberOfListeners === 1,
    postRender.numberOfListeners
  )
  ok('安装后 popup 处于启用状态', popup.enable === true)

  // 禁用后监听应被移除（避免泄漏）
  popup.enable = false
  ok('禁用后 postRender 监听被移除', postRender.numberOfListeners === 0, postRender.numberOfListeners)
  popup.enable = true
  ok('重新启用后监听恢复为 1', postRender.numberOfListeners === 1, postRender.numberOfListeners)

  // _updateWindowCoord 不再整体重写 cssText
  const wrapper = popup._wrapper
  wrapper.style.cssText = 'color: red;'
  popup._config = {}
  popup._wrapperWidth = undefined
  popup._wrapperHeight = undefined
  Object.defineProperty(wrapper, 'offsetWidth', { value: 120, configurable: true })
  Object.defineProperty(wrapper, 'offsetHeight', { value: 60, configurable: true })
  popup._updateWindowCoord({ x: 300, y: 200 })
  ok('定位后保留既有内联样式（未整体重写 cssText）', wrapper.style.color === 'red', wrapper.style.color)
  ok('定位后 visibility 为 visible', wrapper.style.visibility === 'visible')
  ok(
    '定位后 transform 已设置且已按尺寸居中',
    wrapper.style.transform.includes('240px') && wrapper.style.transform.includes('140px'),
    wrapper.style.transform
  )
  const w1 = popup._wrapperWidth
  popup._updateWindowCoord({ x: 400, y: 300 })
  ok('尺寸被缓存（第二次定位不重新测量）', popup._wrapperWidth === w1)
  popup._invalidateSize()
  ok('_invalidateSize 可失效缓存', popup._wrapperWidth === undefined)
}

// ------------------------------------------------- G5 ContextMenu 懒加载
section('G5 · ContextMenu 事件处理器懒加载（运行时行为）')
{
  const canvas = document.createElement('canvas')
  const viewer = {
    canvas,
    scene: { postRender: new Cesium.Event() },
    widgetContainer: document.createElement('div'),
  }
  const menu = new ContextMenu()
  ok('构造后未创建事件处理器', menu._handler === undefined)

  menu.install(viewer)
  ok(
    '安装后仍未创建事件处理器（旧实现在 _installHook 中无条件创建）',
    menu._handler === undefined
  )

  menu.enable = true
  ok('启用后才创建事件处理器', menu._handler !== undefined)
  const handler = menu._handler

  menu.enable = false
  ok('禁用后事件处理器被销毁', menu._handler === undefined)
  ok('销毁确实作用于原处理器', handler.isDestroyed() === true)
}

// ------------------------------------------------- AA 线体抗锯齿：Viewer 默认值
section('AA · Viewer 线体抗锯齿默认值（静态校验）')
{
  const fs = await import('node:fs')
  const viewerSrc = fs.readFileSync(
    new URL('../src/modules/viewer/Viewer.js', import.meta.url),
    'utf8'
  )
  const viewerCode = viewerSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  const defOpts = viewerCode.match(/const DEF_OPTS = \{[\s\S]*?\n\}/)
  ok('定位到 DEF_OPTS', !!defOpts)
  ok(
    'DEF_OPTS 默认关闭 OIT（使半透明折线获得 MSAA）',
    !!defOpts && /orderIndependentTranslucency:\s*false/.test(defOpts[0])
  )
  ok(
    '画布 imageRendering 默认 auto（避免超采样被最近邻抵消）',
    /DEF_CANVAS_IMAGE_RENDERING\s*=\s*'auto'/.test(viewerCode)
  )
  ok(
    'imageRendering 被实际写入 canvas.style',
    /canvas\.style\.imageRendering\s*=/.test(viewerCode)
  )
  ok(
    'imageRendering 可由选项覆盖（不写死）',
    /imageRendering:\s*imageRenderingOpt/.test(viewerCode)
  )
  ok(
    'DC 自有选项不透传给 CesiumWidget（imageRendering 已剥离）',
    /imageRendering:\s*imageRenderingOpt/.test(viewerCode) &&
      !/\.\.\.cesiumOptions[\s\S]{0,40}imageRendering/.test(viewerCode)
  )

  // 折线材质 WebGL2 守卫修复
  const arrowSrc = fs.readFileSync(
    new URL(
      '../src/modules/material/shader/polyline/PolylineDashArrowMaterial.glsl',
      import.meta.url
    ),
    'utf8'
  )
  ok(
    'PolylineDashArrow 的导数守卫已兼容 WebGL2（__VERSION__ == 300）',
    arrowSrc.includes('__VERSION__ == 300')
  )
  ok(
    'PolylineDashArrow 不再使用仅 WebGL1 生效的 #ifdef 分支',
    !/^#ifdef GL_OES_standard_derivatives\s*$\s*float base/m.test(arrowSrc)
  )

  // AA 虚线 shader 的守卫同样必须兼容 WebGL2
  const aaSrc = fs.readFileSync(
    new URL(
      '../src/modules/material/shader/polyline/PolylineDashAAMaterial.glsl',
      import.meta.url
    ),
    'utf8'
  )
  ok(
    'AA 虚线 shader 的导数守卫兼容 WebGL2',
    aaSrc.includes('__VERSION__ == 300')
  )
}

console.log(`\n================ 结果: ${pass} 通过 / ${fail} 失败 ================`)
process.exit(fail === 0 ? 0 : 1)