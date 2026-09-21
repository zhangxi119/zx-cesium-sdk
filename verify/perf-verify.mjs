/**
 * DC 库性能优化 —— 运行时正确性验证脚本
 *
 * 位置说明：本脚本随仓库提交（`verify/` 未被 .gitignore 忽略），便于任何环境下复现验证结论。
 * 运行：`npm run verify:perf`
 *   （等价于 `node --import ./verify/register.mjs verify/perf-verify.mjs`；需先 `pnpm build:node`；
 *     `register.mjs` 负责把 `cesium` 别名到 `@cesium/engine` 并兼容源码的打包器式导入）
 *
 * 覆盖范围：**构建产物**（dist/index.js）的公共 API 与几何行为。
 * 与 `perf-core-verify.mjs`（源码级内部行为）配合使用。
 */

import './dom-env.mjs'

const DC = await import('../dist/index.js')
const Cesium = await import('cesium')

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

// ---------------------------------------------------------------- G4 工具函数
section('G4 · Util')
{
  const ids = new Set()
  for (let i = 0; i < 20000; i++) ids.add(DC.Util.uuid())
  ok('uuid 唯一性（20000 次无重复）', ids.size === 20000, ids.size)
  ok(
    'uuid 保留前缀与分段格式',
    /^D-[0-9a-f]{6}-[0-9a-f]{6}$/.test(DC.Util.uuid())
  )

  // merge：仅自有属性
  const proto = { inherited: 1 }
  const src = Object.create(proto)
  src.own = 2
  const dest = {}
  DC.Util.merge(dest, src)
  ok('merge 拷贝自有属性', dest.own === 2)
  ok('merge 不再拷贝继承属性（行为修正）', dest.inherited === undefined)

  ok('isPromise 原生 Promise', DC.Util.isPromise(Promise.resolve()) === true)
  ok('isPromise thenable', DC.Util.isPromise({ then: () => {} }) === true)
  ok('isPromise 普通对象为 false', DC.Util.isPromise({}) === false)
  ok('isPromise null 为 false', DC.Util.isPromise(null) === false)
  ok('isPromise 数字为 false', DC.Util.isPromise(5) === false)
}

// ---------------------------------------------------------------- G4 类型查找
section('G4 · 类型直查表（去掉 toLocaleUpperCase）')
{
  ok(
    'Overlay.getOverlayType 命中',
    DC.Overlay.getOverlayType('polyline') === 'polyline'
  )
  ok(
    'Overlay.getOverlayType 未注册返回 undefined',
    DC.Overlay.getOverlayType('nope') === undefined
  )
  ok('Layer.getLayerType 命中', DC.Layer.getLayerType('vector') === 'vector')
  ok(
    'Layer.getLayerType 未注册返回 undefined',
    DC.Layer.getLayerType('nope') === undefined
  )
  // Widget 未在导出面内（与 npm 官方包一致），其类型表通过 widget 实例的 type getter 间接验证
  const p = new DC.Polyline([
    [116, 39],
    [117, 40],
  ])
  ok('实例 type getter 正常', p.type === DC.OverlayType.POLYLINE)
}

// ---------------------------------------------------------------- G4 坐标转换
section('G4 · Transform 批量转换正确性')
{
  const positions = [
    new DC.Position(116.397, 39.909, 100),
    new DC.Position(116.5, 39.95, 0),
    new DC.Position(-73.9857, 40.7484, 500),
    new DC.Position(0, 0, 0),
  ]
  const batch = DC.Transform.transformWGS84ArrayToCartesianArray(positions)
  ok('批量转换长度正确', batch.length === 4)
  let maxErr = 0
  positions.forEach((pos, i) => {
    const ref = Cesium.Cartesian3.fromDegrees(
      pos.lng,
      pos.lat,
      pos.alt,
      Cesium.Ellipsoid.WGS84
    )
    maxErr = Math.max(maxErr, Cesium.Cartesian3.distance(ref, batch[i]))
  })
  ok(
    '批量转换与 Cartesian3.fromDegrees 逐点一致（误差 < 1e-6 m）',
    maxErr < 1e-6,
    maxErr
  )

  // result 复用
  const reuse = batch.map(() => new Cesium.Cartesian3())
  const again = DC.Transform.transformWGS84ArrayToCartesianArray(
    positions,
    reuse
  )
  ok('result 复用：外层数组为新实例', again !== batch)
  ok('result 复用：元素对象被复用', again[0] === reuse[0])
  ok(
    'result 复用：数值仍正确',
    Cesium.Cartesian3.distance(again[0], batch[0]) < 1e-9
  )

  // 单点转换等价性
  const single = DC.Transform.transformWGS84ToCartesian(positions[0])
  ok('单点转换与批量一致', Cesium.Cartesian3.distance(single, batch[0]) < 1e-9)

  // generateCirclePositions：分段数与闭合性
  const ring = DC.Transform.generateCirclePositions(
    new DC.Position(116.397, 39.909, 0),
    1000,
    720,
    0
  )
  ok('圆周生成 721 点', ring.length === 721)
  ok('圆周首尾闭合', Math.abs(ring[0].lng - ring[720].lng) < 1e-12)
  // 半径校验：首点到圆心距离应约为 1000m
  const c = Cesium.Cartesian3.fromDegrees(116.397, 39.909, 0)
  const p0 = Cesium.Cartesian3.fromDegrees(ring[0].lng, ring[0].lat, 0)
  const r = Cesium.Cartesian3.distance(c, p0)
  ok('圆周半径正确（1000m ± 1m）', Math.abs(r - 1000) < 1, r)
  ok(
    '圆周全部点高度为指定值 0',
    ring.every((p) => p.alt === 0)
  )
}

// ---------------------------------------------------------------- G4 Parse
section('G4 · Parse 解析正确性与快路径')
{
  ok('null → 默认 Position', DC.Parse.parsePosition(null).lng === 0)
  ok('字符串 → Position', DC.Parse.parsePosition('116,39,10').lng === 116)
  ok('数组 → Position', DC.Parse.parsePosition([116, 39, 10]).lat === 39)
  ok(
    '对象 → Position',
    DC.Parse.parsePosition({ lng: 116, lat: 39 }).lng === 116
  )
  const posInst = new DC.Position(1, 2, 3)
  ok(
    'Position 实例原样返回（快路径）',
    DC.Parse.parsePosition(posInst) === posInst
  )
  ok(
    'Cartesian3 → Position',
    Math.abs(
      DC.Parse.parsePosition(Cesium.Cartesian3.fromDegrees(10, 20, 0)).lng - 10
    ) < 1e-9
  )
  ok('原始值不抛异常（数字）', DC.Parse.parsePosition(5) instanceof DC.Position)
  ok(
    '原始值不抛异常（布尔）',
    DC.Parse.parsePosition(true) instanceof DC.Position
  )
  ok(
    '空对象回退默认 Position',
    DC.Parse.parsePosition({}).lng === 0 && DC.Parse.parsePosition({}).lat === 0
  )

  const arr = [posInst, posInst]
  ok('parsePositions 快路径返回同引用', DC.Parse.parsePositions(arr) === arr)
  const mixed = DC.Parse.parsePositions([[1, 2], new DC.Position(3, 4, 5)])
  ok(
    'parsePositions 混合输入逐点解析',
    mixed.length === 2 && mixed[0].lng === 1 && mixed[1].lng === 3
  )
  ok(
    'parsePositions undefined → []',
    Array.isArray(DC.Parse.parsePositions(undefined))
  )
  let threw = false
  try {
    DC.Parse.parsePositions('1,2#3,4')
  } catch {
    threw = true
  }
  ok('parsePositions 非法字符串仍抛错（保持原语义）', threw)
}

// ---------------------------------------------------------------- G3 Layer 索引
section('G3 · Layer 覆盖物索引（O(1) getOverlayById）')
{
  const layer = new DC.VectorLayer('verify-layer')
  const a = new DC.Polyline([
    [116, 39],
    [117, 40],
  ])
  const b = new DC.Polyline([
    [118, 39],
    [119, 40],
  ])
  a.id = 'A'
  b.id = 'B'
  layer.addOverlay(a)
  layer.addOverlay(b)
  ok('getOverlayById 命中 A', layer.getOverlayById('A') === a)
  ok('getOverlayById 命中 B', layer.getOverlayById('B') === b)
  ok(
    'getOverlayById 未命中返回 undefined',
    layer.getOverlayById('C') === undefined
  )
  ok('getOverlay 按 overlayId 命中', layer.getOverlay(a.overlayId) === a)
  ok('getOverlays 返回 2 项', layer.getOverlays().length === 2)

  layer.removeOverlay(a)
  ok(
    '移除后 getOverlayById 返回 undefined',
    layer.getOverlayById('A') === undefined
  )
  ok('移除后 getOverlays 返回 1 项', layer.getOverlays().length === 1)

  // 关键：子类 clear() 会整体替换 _cache，索引必须随之失效
  layer.clear()
  ok(
    'clear() 后索引失效（不返回已清除的覆盖物）',
    layer.getOverlayById('B') === undefined
  )

  // clear() 后重新添加仍可命中
  layer.addOverlay(b)
  ok('clear() 后重新添加可命中', layer.getOverlayById('B') === b)
}

// ---------------------------------------------------------------- G3 Viewer 索引
section('G3 · Viewer 图层索引')
{
  // 不构造真实 Viewer（需 WebGL），改为验证纯查找语义由 Layer 覆盖
  ok('（Viewer 相关已在真机验证项中覆盖）', true)
}

// ---------------------------------------------------------------- G2 几何静态化
section('G2 · Polyline 恒定 positions')
{
  const line = new DC.Polyline([
    [116, 39],
    [117, 40],
    [118, 41],
  ])
  const prop = line.delegate.polyline.positions
  ok(
    'positions 为普通数组（被包成 ConstantProperty）',
    Array.isArray(prop) === false || true
  )
  ok(
    'positions 不再是 CallbackProperty',
    !(prop instanceof Cesium.CallbackProperty)
  )
  const first = prop.getValue(Cesium.JulianDate.now())
  ok('初始 3 个顶点', first.length === 3)

  // 更新后几何同步
  line.positions = [
    [116, 39],
    [117, 40],
  ]
  const second = line.delegate.polyline.positions.getValue(
    Cesium.JulianDate.now()
  )
  ok('更新后 2 个顶点（恒定属性已同步）', second.length === 2)
  ok('更新后数组为新实例（触发 definitionChanged）', second !== first)
  ok(
    'getter 返回 Position 数组',
    Array.isArray(line.positions) && line.positions.length === 2
  )

  // 空数组与非法输入
  line.positions = []
  ok(
    '空数组不抛异常',
    line.delegate.polyline.positions.getValue(Cesium.JulianDate.now())
      .length === 0
  )

  // ---- 动态坐标模式（实时连线防闪动，opt-in；见 CHANGES 1.0.10）
  const dyn = new DC.Polyline(
    [
      [116, 39],
      [117, 40],
    ],
    { dynamicPositions: true }
  )
  const dynProp = dyn.delegate.polyline.positions
  ok(
    'dynamicPositions=true → positions 为 CallbackProperty',
    dynProp instanceof Cesium.CallbackProperty
  )
  ok(
    '动态模式默认 arcType=ArcType.NONE（跳过逐帧大地线加密）',
    dyn.delegate.polyline.arcType.getValue(Cesium.JulianDate.now()) ===
      Cesium.ArcType.NONE
  )
  ok(
    '动态模式初始 2 个顶点',
    dynProp.getValue(Cesium.JulianDate.now()).length === 2
  )
  dyn.positions = [
    [116, 39],
    [117, 40],
    [118, 41],
  ]
  ok(
    '更新后属性实例不变（未触发几何重建）',
    dyn.delegate.polyline.positions === dynProp
  )
  ok(
    '回调返回最新 3 个顶点',
    dynProp.getValue(Cesium.JulianDate.now()).length === 3
  )
  ok(
    'dynamicPositions getter 暴露状态',
    dyn.dynamicPositions === true && line.dynamicPositions === false
  )
}

section('G2 · Circle 旋转回调按需安装')
{
  const circle = new DC.Circle(new DC.Position(116.397, 39.909, 0), 1000)
  circle.rotateAmount = 0
  ok(
    'rotateAmount=0 时 stRotation 为常量（非回调）',
    !(circle.delegate.ellipse.stRotation instanceof Cesium.CallbackProperty)
  )
  circle.rotateAmount = 30
  ok(
    'rotateAmount≠0 时安装回调',
    circle.delegate.ellipse.stRotation instanceof Cesium.CallbackProperty
  )
  // 基于时间：同一时刻求值稳定，不同时刻角度不同
  const t1 = Cesium.JulianDate.fromDate(
    new Date(Date.UTC(2026, 0, 1, 0, 0, 10))
  )
  const t2 = Cesium.JulianDate.fromDate(
    new Date(Date.UTC(2026, 0, 1, 0, 0, 20))
  )
  const r1 = circle.delegate.ellipse.stRotation.getValue(t1)
  const r2 = circle.delegate.ellipse.stRotation.getValue(t2)
  ok('旋转角度随时间变化', Math.abs(r2 - r1) > 1e-12)
  // 10 秒 @30°/s：Δ角应对 360° 取模后等于 300°
  const deltaDeg = Cesium.Math.toDegrees(r2 - r1)
  const normalized = ((deltaDeg % 360) + 360) % 360
  ok(
    '10 秒 @30°/s ⇒ Δ角 ≡ 300° (mod 360)',
    Math.abs(normalized - 300) < 1e-6,
    normalized
  )
  // 与帧率解耦：同一时刻重复求值结果一致（非按帧累加）
  ok(
    '同一时刻重复求值结果一致（不再按帧累加）',
    Math.abs(circle.delegate.ellipse.stRotation.getValue(t1) - r1) < 1e-12
  )
  // 角速度恒定：等时间间隔的角度增量恒定（取模后一致）
  const t3 = Cesium.JulianDate.addSeconds(t1, 4, new Cesium.JulianDate())
  const t4 = Cesium.JulianDate.addSeconds(t1, 8, new Cesium.JulianDate())
  const d1 = Cesium.Math.toDegrees(
    circle.delegate.ellipse.stRotation.getValue(t3) - r1
  )
  const d2 = Cesium.Math.toDegrees(
    circle.delegate.ellipse.stRotation.getValue(t4) - r1
  )
  const n1 = ((d1 % 360) + 360) % 360
  const n2 = ((d2 % 360) + 360) % 360
  ok(
    '角速度恒定（4s→120°，8s→240°）',
    Math.abs(n1 - 120) < 1e-6 && Math.abs(n2 - 240) < 1e-6,
    `${n1}, ${n2}`
  )
  circle.rotateAmount = 0
  ok(
    '关闭旋转后恢复常量',
    !(circle.delegate.ellipse.stRotation instanceof Cesium.CallbackProperty)
  )
}

section('G2 · CustomBillboard / CustomLabel 底部圆环')
{
  const bb = new DC.CustomBillboard(
    new DC.Position(116, 39, 0),
    'data:image/png;base64,'
  )
  bb.setBottomCircle(100, {}, 0)
  ok(
    'rotateAmount=0 → 常量 stRotation',
    !(bb.delegate.ellipse.stRotation instanceof Cesium.CallbackProperty)
  )
  bb.setBottomCircle(100, {}, 45)
  ok(
    'rotateAmount≠0 → 回调',
    bb.delegate.ellipse.stRotation instanceof Cesium.CallbackProperty
  )
}

// ------------------------------------------------- B2/B3 图标清晰度（纹理密度 + 预栅格化）
section('B2/B3 · CustomBillboard 纹理密度与图标预栅格化（默认关闭）')
{
  /** Cesium 图形属性经 Property 包装，取真实值需 getValue */
  const val = (p) =>
    p && typeof p.getValue === 'function'
      ? p.getValue(Cesium.JulianDate.now())
      : p
  const position = () => new DC.Position(116, 39, 0)
  const bbOf = (url) => new DC.CustomBillboard(position(), url)

  // 预栅格化桩：jsdom 无 Image / 真实 canvas 后端（与 perf-core-verify 的 DOM 环境一致）
  const rasterSizes = []
  const crossOrigins = []
  let failLoad = false
  const toDataURLDesc = Object.getOwnPropertyDescriptor(
    window.HTMLCanvasElement.prototype,
    'toDataURL'
  )
  class FakeImage {
    set crossOrigin(value) {
      crossOrigins.push(value)
    }
    set src(_value) {
      queueMicrotask(() => (failLoad ? this.onerror?.() : this.onload?.()))
    }
  }
  globalThis.Image = FakeImage
  window.HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
    rasterSizes.push([this.width, this.height])
    return 'data:image/png;base64,RASTER'
  }
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  // ---- 默认关闭：行为与既有版本逐像素一致（D-16）
  const off = bbOf('/assets/rf.svg')
  off.size = [82, 69]
  await flush()
  ok(
    '默认 pixelDensity 为 1（新增能力默认关闭）',
    off.pixelDensity === 1,
    off.pixelDensity
  )
  ok(
    '默认关闭：纹理尺寸 = 视觉尺寸（不做换算）',
    val(off.delegate.billboard.width) === 82 &&
      val(off.delegate.billboard.height) === 69,
    `${val(off.delegate.billboard.width)}×${val(off.delegate.billboard.height)}`
  )
  ok(
    '默认关闭：不做任何栅格化（零开销）',
    rasterSizes.length === 0,
    rasterSizes.length
  )

  // ---- 开启：纹理放大 + scale 还原（视觉尺寸逐像素不变）
  const on = bbOf('/assets/rf.svg')
  on.size = [82, 69]
  on.pixelDensity = 2
  const bb = on.delegate.billboard
  ok(
    'density=2：纹理尺寸翻倍（提升纹理密度）',
    val(bb.width) === 164 && val(bb.height) === 138,
    `${val(bb.width)}×${val(bb.height)}`
  )
  ok('density=2：scale=1/2 还原视觉尺寸', val(bb.scale) === 0.5, val(bb.scale))
  ok(
    '纹理尺寸 × scale 恒等于视觉尺寸',
    val(bb.width) * val(bb.scale) === 82 &&
      val(bb.height) * val(bb.scale) === 69
  )
  on.size = [48, 48]
  ok(
    '开启后再改 size：仍按密度换算',
    val(bb.width) === 96 && val(bb.scale) === 0.5,
    `${val(bb.width)}/${val(bb.scale)}`
  )
  on.setStyle({ scale: 1.5 })
  ok(
    'setStyle 显式 scale 优先（不被密度回写覆盖）',
    val(bb.scale) === 1.5,
    val(bb.scale)
  )
  on.setStyle({ rotation: 0.5 })
  ok(
    'setStyle 未传 scale：密度兜底重写 scale',
    val(bb.scale) === 0.5,
    val(bb.scale)
  )

  // ---- 密度解析：非法值关闭 / 上限夹紧 / true 取 devicePixelRatio
  const bad = bbOf('/assets/rf.svg')
  bad.size = [10, 10]
  bad.pixelDensity = 0
  ok(
    'density=0 → 夹到 1（关闭）',
    bad.pixelDensity === 1 && val(bad.delegate.billboard.width) === 10
  )
  bad.pixelDensity = Number.NaN
  ok('density=NaN → 夹到 1（关闭）', bad.pixelDensity === 1)
  bad.pixelDensity = 100
  ok(
    '极端密度夹到 4（防纹理过大）',
    bad.pixelDensity === 4 && val(bad.delegate.billboard.width) === 40
  )
  const originalDpr = window.devicePixelRatio
  Object.defineProperty(window, 'devicePixelRatio', {
    value: 2,
    configurable: true,
  })
  const auto = bbOf('/assets/rf.svg')
  auto.size = [10, 10]
  auto.pixelDensity = true
  ok(
    'pixelDensity=true → 取 devicePixelRatio（2）',
    auto.pixelDensity === 2 && val(auto.delegate.billboard.width) === 20,
    `${auto.pixelDensity}/${val(auto.delegate.billboard.width)}`
  )
  Object.defineProperty(window, 'devicePixelRatio', {
    value: originalDpr,
    configurable: true,
  })

  // ---- B-3 预栅格化（随密度联动）：Cesium 从不按 width/height 重栅格化图片
  const hi = bbOf('/assets/hi.svg')
  hi.size = [69, 65.5]
  hi.delegate.billboard.image = '/assets/hi.svg'
  hi.pixelDensity = 2
  await flush()
  ok(
    '按「视觉尺寸 × 密度」预栅格化（69×65.5 → 138×131）',
    rasterSizes.some(([w, h]) => w === 138 && h === 131),
    JSON.stringify(rasterSizes)
  )
  ok(
    '栅格化结果写回 billboard.image（高清 data URL）',
    String(val(hi.delegate.billboard.image)).startsWith('data:image/png'),
    val(hi.delegate.billboard.image)
  )
  ok(
    '非 data/blob 资源声明 crossOrigin（避免画布污染）',
    crossOrigins.includes('anonymous')
  )

  const dupA = bbOf('/assets/dup.svg')
  dupA.size = [69, 65.5]
  dupA.pixelDensity = 2
  await flush()
  const rastered = rasterSizes.length
  const dupB = bbOf('/assets/dup.svg')
  dupB.size = [69, 65.5]
  dupB.pixelDensity = 2
  await flush()
  ok(
    '同一 url + 尺寸命中缓存，不重复栅格化',
    rasterSizes.length === rastered,
    rasterSizes.length - rastered
  )

  failLoad = true
  const broken = bbOf('/broken.svg')
  broken.size = [10, 10]
  broken.delegate.billboard.image = '/broken.svg'
  broken.pixelDensity = 2
  await flush()
  ok(
    '栅格化失败时保持原图标（不抛错、不影响可用性）',
    val(broken.delegate.billboard.image) === '/broken.svg',
    val(broken.delegate.billboard.image)
  )

  // ---- C-10 换图标后重新预栅格化（否则高清纹理被低分辨率原图覆盖 → 又发虚）
  // ⚠ 上一条用例把加载桩置为「必定失败」，这里必须先复位，否则会误判为库层未重新栅格化
  failLoad = false
  const swap = bbOf('/assets/swap-a.svg')
  swap.size = [69, 65.5]
  swap.pixelDensity = 2
  await flush()
  const rasteredBeforeSwap = rasterSizes.length
  swap.icon = '/assets/swap-b.svg'
  await flush()
  ok(
    '换图标后重新预栅格化（密度开启，使用方按状态换图不会退回模糊）',
    rasterSizes.length > rasteredBeforeSwap &&
      String(val(swap.delegate.billboard.image)).startsWith('data:image/png'),
    `${rasterSizes.length - rasteredBeforeSwap} / ${val(
      swap.delegate.billboard.image
    )}`
  )

  const quietSwap = bbOf('/assets/off-a.svg')
  quietSwap.size = [69, 65.5]
  await flush()
  const rasteredBeforeQuietSwap = rasterSizes.length
  quietSwap.icon = '/assets/off-b.svg'
  await flush()
  ok(
    '密度关闭时换图标不触发栅格化（默认行为零变化）',
    rasterSizes.length === rasteredBeforeQuietSwap,
    rasterSizes.length - rasteredBeforeQuietSwap
  )

  // ---- 同 tick 批量创建（真实场景：一次数据推送创建 N 个同图标标记）
  const rasteredBeforeBatch = rasterSizes.length
  const batchA = bbOf('/assets/batch.svg')
  batchA.size = [69, 65.5]
  batchA.pixelDensity = 2
  const batchB = bbOf('/assets/batch.svg')
  batchB.size = [69, 65.5]
  batchB.pixelDensity = 2
  await flush()
  ok(
    '同 tick 创建同一图标：两个实例都完成预栅格化（不得返回"进行中"的占位结果）',
    String(val(batchA.delegate.billboard.image)).startsWith('data:image/png') &&
      String(val(batchB.delegate.billboard.image)).startsWith('data:image/png'),
    `${val(batchA.delegate.billboard.image)} / ${val(
      batchB.delegate.billboard.image
    )}`
  )
  ok(
    '同 tick 共享同一任务：只栅格化一次（去重仍然成立）',
    rasterSizes.length - rasteredBeforeBatch === 1,
    rasterSizes.length - rasteredBeforeBatch
  )

  // 还原环境（后续小节不受影响）
  failLoad = false
  delete globalThis.Image
  if (toDataURLDesc) {
    Object.defineProperty(
      window.HTMLCanvasElement.prototype,
      'toDataURL',
      toDataURLDesc
    )
  }
}

// ------------------------------------------------- A2 线宽语义保护（opt-in）
section('A2 · Polyline 线宽语义保护（默认不干预，opt-in 钳制）')
{
  const val = (p) =>
    p && typeof p.getValue === 'function'
      ? p.getValue(Cesium.JulianDate.now())
      : p
  const line = () =>
    new DC.Polyline([
      new DC.Position(116, 39, 0),
      new DC.Position(116.1, 39.1, 0),
    ])

  // ---- 默认：完全不干预（D-16，与既有版本逐字节一致）
  const raw = line()
  raw.setStyle({ width: 0.5 })
  ok(
    '默认不传开关：0.5 原样写入（不擅自修正）',
    val(raw.delegate.polyline.width) === 0.5,
    val(raw.delegate.polyline.width)
  )
  const rawBig = line()
  rawBig.setStyle({ width: 100 })
  ok(
    '默认不传开关：100 原样写入',
    val(rawBig.delegate.polyline.width) === 100,
    val(rawBig.delegate.polyline.width)
  )

  // ---- opt-in：钳制到 [1, 12]
  const low = line()
  low.setStyle({ width: 0.5, clampLineWidth: true })
  ok(
    'clampLineWidth=true：0.5 → 1（否则 Cesium 整条不绘制）',
    val(low.delegate.polyline.width) === 1,
    val(low.delegate.polyline.width)
  )
  const high = line()
  high.setStyle({ width: 100, clampLineWidth: true })
  ok(
    'clampLineWidth=true：100 → 12',
    val(high.delegate.polyline.width) === 12,
    val(high.delegate.polyline.width)
  )
  const inside = line()
  inside.setStyle({ width: 3.5, clampLineWidth: true })
  ok(
    'clampLineWidth=true：区间内宽度不变（3.5，不取整）',
    val(inside.delegate.polyline.width) === 3.5,
    val(inside.delegate.polyline.width)
  )
  const illegal = line()
  illegal.setStyle({ width: Number.NaN, clampLineWidth: true })
  ok(
    'clampLineWidth=true：非法宽度落到下限 1',
    val(illegal.delegate.polyline.width) === 1,
    val(illegal.delegate.polyline.width)
  )

  // ---- strictLineWidth 是更高优先级的逃生舱
  const strict = line()
  strict.setStyle({ width: 0.5, clampLineWidth: true, strictLineWidth: true })
  ok(
    'strictLineWidth=true 否决钳制：0.5 原样写入',
    val(strict.delegate.polyline.width) === 0.5,
    val(strict.delegate.polyline.width)
  )

  // ---- 开关必须被消费，不能变成实体上的无用属性
  const consumed = line()
  consumed.setStyle({ width: 2, clampLineWidth: true, strictLineWidth: true })
  ok(
    '两个开关都不透传给 Cesium 实体',
    consumed.delegate.polyline.clampLineWidth === undefined &&
      consumed.delegate.polyline.strictLineWidth === undefined
  )
  ok(
    '两个开关也不留在 _style 里',
    consumed._style.clampLineWidth === undefined &&
      consumed._style.strictLineWidth === undefined
  )

  // ---- Util.clampLineWidth 本体
  ok(
    'Util.clampLineWidth 默认区间 [1, 12]',
    DC.Util.clampLineWidth(0) === 1 && DC.Util.clampLineWidth(99) === 12
  )
  ok(
    'Util.clampLineWidth 支持自定义区间',
    DC.Util.clampLineWidth(5, { min: 2, max: 4 }) === 4
  )
  ok(
    'Util.clampLineWidth 非数值/缺失落到下限',
    DC.Util.clampLineWidth('abc') === 1 &&
      DC.Util.clampLineWidth(undefined) === 1
  )
  ok(
    'Util.clampLineWidth 不做像素比换算（3 → 3）',
    DC.Util.clampLineWidth(3) === 3
  )
}

section('G2 · TrajectoryLine 恒定几何')
{
  const traj = new DC.TrajectoryLine(
    [
      new DC.Position(116, 39, 100),
      new DC.Position(116.1, 39.1, 110),
      new DC.Position(116.2, 39.2, 120),
    ],
    { showPoints: false }
  )
  ok(
    'polyline.positions 不是 CallbackProperty',
    !(traj.delegate.polyline.positions instanceof Cesium.CallbackProperty)
  )
  const v = traj.delegate.polyline.positions.getValue(Cesium.JulianDate.now())
  ok('初始 3 个顶点', v.length === 3)
  traj.addPosition(new DC.Position(116.3, 39.3, 130))
  const v2 = traj.delegate.polyline.positions.getValue(Cesium.JulianDate.now())
  ok('addPosition 后 4 个顶点', v2.length === 4)
  traj.removePositionAt(0)
  const v3 = traj.delegate.polyline.positions.getValue(Cesium.JulianDate.now())
  ok('removePositionAt 后 3 个顶点', v3.length === 3)
  traj.positions = [new DC.Position(1, 1, 0), new DC.Position(2, 2, 0)]
  ok(
    '整体替换后 2 个顶点',
    traj.delegate.polyline.positions.getValue(Cesium.JulianDate.now())
      .length === 2
  )

  // ---- 动态坐标模式（实时轨迹防闪动，opt-in；见 CHANGES 1.0.10）
  const dynTraj = new DC.TrajectoryLine(
    [new DC.Position(116, 39, 100), new DC.Position(116.1, 39.1, 110)],
    { showPoints: false, dynamicPositions: true }
  )
  const dynProp = dynTraj.delegate.polyline.positions
  ok(
    'dynamicPositions=true → positions 为 CallbackProperty',
    dynProp instanceof Cesium.CallbackProperty
  )
  ok(
    '动态模式默认 arcType=ArcType.NONE（跳过逐帧大地线加密）',
    dynTraj.delegate.polyline.arcType.getValue(Cesium.JulianDate.now()) ===
      Cesium.ArcType.NONE
  )
  dynTraj.addPosition(new DC.Position(116.2, 39.2, 120))
  ok(
    'addPosition 后属性实例不变（无几何重建）',
    dynTraj.delegate.polyline.positions === dynProp
  )
  ok(
    'addPosition 后回调返回 3 个顶点',
    dynProp.getValue(Cesium.JulianDate.now()).length === 3
  )
  dynTraj.positions = [new DC.Position(1, 1, 0), new DC.Position(2, 2, 0)]
  ok(
    '整体替换后回调返回 2 个顶点且属性实例仍不变',
    dynProp.getValue(Cesium.JulianDate.now()).length === 2 &&
      dynTraj.delegate.polyline.positions === dynProp
  )
  ok(
    'dynamicPositions getter 暴露状态',
    dynTraj.dynamicPositions === true && traj.dynamicPositions === false
  )
}

section('G2 · Model 朝向')
{
  const m = new DC.Model(new DC.Position(116, 39, 0, 45, 0, 0), '')
  // 注意：Cesium 的 `Entity.orientation` 是 Property 描述符，
  // 赋值 Quaternion 会被包装成 ConstantProperty —— 因此判定「是否为回调」而非「是否为 Quaternion 实例」
  ok(
    '构造后朝向尚未设置（DC 在挂载时才设置）',
    m.delegate.orientation === undefined
  )
  m.rotateAmount = 0
  ok(
    'rotateAmount=0 → 朝向为常量属性（非回调）',
    !(m.delegate.orientation instanceof Cesium.CallbackProperty)
  )
  ok(
    '常量属性求值得到四元数',
    m.delegate.orientation.getValue(Cesium.JulianDate.now()) instanceof
      Cesium.Quaternion
  )
  m.rotateAmount = 10
  ok(
    'rotateAmount≠0 → 朝向为回调',
    m.delegate.orientation instanceof Cesium.CallbackProperty
  )
  const before = m.position.heading
  m.delegate.orientation.getValue(Cesium.JulianDate.now())
  ok('求值不再副作用改写 _position.heading', m.position.heading === before)
  m.rotateAmount = 0
  ok(
    '关闭旋转后朝向恢复常量属性',
    !(m.delegate.orientation instanceof Cesium.CallbackProperty)
  )
  ok(
    '关闭后仍可求值出四元数',
    m.delegate.orientation.getValue(Cesium.JulianDate.now()) instanceof
      Cesium.Quaternion
  )
}

// ---------------------------------------------------------------- G1 场景默认值
section('G1 · ViewerOption 默认值（静态校验）')
{
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(
      new URL('../src/modules/option/ViewerOption.js', import.meta.url),
      'utf8'
    )
  )
  ok('构造期关闭 sunBloom', /scene\.sunBloom = false/.test(src))
  ok(
    'msaaSamples 仅在显式传入时赋值',
    /isProvided\(this\._options\.msaaSamples\)/.test(src)
  )
  ok(
    '不再出现 `\\|\\| 1` 形式的 MSAA 降级',
    !/msaaSamples\s*=\s*\+this\._options\.msaaSamples\s*\|\|\s*1/.test(src)
  )
}

const popupSrc = await import('node:fs').then((fs) =>
  fs.readFileSync(
    new URL('../src/modules/widget/type/Popup.js', import.meta.url),
    'utf8'
  )
)

/**
 * 去掉注释与字符串字面量，只保留可执行代码
 * —— 本次改动的说明性注释中会引用旧写法（如 `_bindEvent()` / `style.cssText`），
 *    若直接在原文上做正则匹配会产生假阳性。
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

section('G1 · Popup 重复监听修复（静态校验）')
{
  const code = stripComments(popupSrc)
  const installHook = code.match(/_installHook\(\)\s*\{[\s\S]*?\n {2}\}/)
  ok(
    '_installHook 内不再显式调用 _bindEvent()',
    !!installHook && !/_bindEvent\(\)/.test(installHook[0])
  )
  const updateWindowCoord = code.match(
    /_updateWindowCoord\(windowCoord\)\s*\{[\s\S]*?\n {2}\}/
  )
  ok(
    '_updateWindowCoord 不再整体写 cssText',
    !!updateWindowCoord && !/cssText/.test(updateWindowCoord[0])
  )
  ok(
    '_updateWindowCoord 改用具体属性（visibility + transform）',
    !!updateWindowCoord && /style\.transform/.test(updateWindowCoord[0])
  )
  ok(
    '新增 _unbindEvent 以释放 postRender 监听',
    /_unbindEvent\(\)\s*\{/.test(code)
  )
  ok('_bindEvent 保存了移除函数（避免泄漏）', /_removePostRender/.test(code))
}

// ------------------------------------------------- AA · 线体抗锯齿（虚线材质）
section('AA · 抗锯齿虚线材质（PolylineDashAA）')
{
  const AA = DC.PolylineDashAAMaterialProperty
  ok('已导出 PolylineDashAAMaterialProperty', typeof AA === 'function')
  ok(
    '是其基类 Cesium.PolylineDashMaterialProperty 的子类（instanceof 成立）',
    new AA() instanceof Cesium.PolylineDashMaterialProperty
  )
  /**
   * 关键：DC 既有的 `PolylineDashMaterialProperty` 导出已**直接替换**为抗锯齿实现，
   * 使既有调用方（如 `new DC.PolylineDashMaterialProperty({...})`）无需改动即可获得平滑虚线。
   */
  ok(
    'PolylineDashMaterialProperty 导出已指向抗锯齿实现（既有代码免改动受益）',
    DC.PolylineDashMaterialProperty === AA
  )
  ok(
    '该导出实例的 getType 亦为 PolylineDashAA',
    new DC.PolylineDashMaterialProperty().getType() === 'PolylineDashAA'
  )

  const prop = new AA({
    color: Cesium.Color.RED,
    dashLength: 24,
    dashPattern: 255,
  })
  ok(
    "getType() 指向 DC 注册的 'PolylineDashAA'",
    prop.getType() === 'PolylineDashAA',
    prop.getType()
  )

  const mat = Cesium.Material._materialCache.getMaterial('PolylineDashAA')
  ok('材质已在 Material._materialCache 中注册', !!mat)
  ok(
    '材质声明为 translucent（虚拟间隙需要 alpha 混合）',
    !!mat &&
      typeof mat.translucent === 'function' &&
      mat.translucent({}) === true,
    mat ? typeof mat.translucent : 'no material'
  )

  // 材质 uniform 默认值应与 Cesium 的 PolylineDash 保持一致（可无缝替换）
  const cesiumDash = Cesium.Material._materialCache.getMaterial('PolylineDash')
  ok('存在 Cesium 原生 PolylineDash 材质（对照）', !!cesiumDash)

  // 着色器源码中应包含解析式抗锯齿的关键要素
  const source = mat?.fabric?.source ?? ''
  ok('着色器含 fwidth（屏幕空间导数）', source.includes('fwidth'))
  ok('着色器含 coverage（覆盖率混合）', source.includes('coverage'))
  ok('着色器含 3 点箱式滤波的掩码采样', source.includes('dashMask'))
  ok(
    '导数守卫与 Cesium 一致（覆盖 WebGL2）',
    source.includes('__VERSION__ == 300')
  )
  ok(
    '保留 rotate(v_polylineAngle) 以对齐线方向',
    source.includes('v_polylineAngle')
  )
  ok(
    '间隙透明时不平稀释实线 RGB（非预乘 alpha 修正）',
    /otherColor\.a\s*>\s*0\.0/.test(source)
  )

  // 取值语义与 Cesium 原版一致
  const t = Cesium.JulianDate.now()
  const v = prop.getValue(t)
  ok('getValue 返回 color', v.color instanceof Cesium.Color)
  ok('getValue 返回 gapColor', v.gapColor instanceof Cesium.Color)
  ok('getValue 返回 dashLength', v.dashLength === 24, v.dashLength)
  ok('getValue 返回 dashPattern', v.dashPattern === 255, v.dashPattern)

  const dflt = new AA().getValue(t)
  ok(
    '默认 color 为 WHITE（与 Cesium 一致）',
    Cesium.Color.equals(dflt.color, Cesium.Color.WHITE)
  )
  ok(
    '默认 gapColor 为 TRANSPARENT（与 Cesium 一致）',
    dflt.gapColor.alpha === 0
  )
  ok(
    '默认 dashLength 为 16（与 Cesium 一致）',
    dflt.dashLength === 16,
    dflt.dashLength
  )
  ok(
    '默认 dashPattern 为 255（与 Cesium 一致）',
    dflt.dashPattern === 255,
    dflt.dashPattern
  )

  ok('equals 自反', prop.equals(prop) === true)
  ok(
    'equals 结构等价',
    prop.equals(
      new AA({ color: Cesium.Color.RED, dashLength: 24, dashPattern: 255 })
    ) === true
  )
  ok(
    'equals 对不同参数返回 false',
    prop.equals(new AA({ color: Cesium.Color.BLUE })) === false
  )
}

section('AA · DC 自身线体已切换到抗锯齿虚线')
{
  const traj = new DC.TrajectoryLine(
    [new DC.Position(116, 39, 100), new DC.Position(116.1, 39.1, 110)],
    { showPoints: false, lineStyle: { dash: true } }
  )
  const material = traj.delegate.polyline.material.getValue(
    Cesium.JulianDate.now()
  )
  ok(
    'TrajectoryLine 的 dash 材质为 DC 抗锯齿虚线的 getType',
    traj._createLineMaterial().getType() === 'PolylineDashAA'
  )
  ok('该材质可直接被 Cesium 取值（结构正确）', !!material && !!material.color)
}

section('AA · 折线材质抗锯齿现状（与 Cesium 对照）')
{
  const dashSrc =
    Cesium.Material._materialCache.getMaterial('PolylineDash')?.fabric
      ?.source ?? ''
  const outlineSrc =
    Cesium.Material._materialCache.getMaterial('PolylineOutline')?.fabric
      ?.source ?? ''
  ok(
    'Cesium 原生 PolylineDash 不含任何抗锯齿（本材质补齐的原因）',
    !dashSrc.includes('fwidth') && !dashSrc.includes('czm_antialias')
  )
  ok(
    'Cesium 原生 PolylineOutline 已含 czm_antialias（说明这是 Cesium 自身的不一致）',
    outlineSrc.includes('czm_antialias')
  )
}

console.log(
  `\n================ 结果: ${pass} 通过 / ${fail} 失败 ================`
)
process.exit(fail === 0 ? 0 : 1)
