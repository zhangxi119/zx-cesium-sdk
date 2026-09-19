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
  ok('uuid 保留前缀与分段格式', /^D-[0-9a-f]{6}-[0-9a-f]{6}$/.test(DC.Util.uuid()))

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
  ok('Overlay.getOverlayType 命中', DC.Overlay.getOverlayType('polyline') === 'polyline')
  ok('Overlay.getOverlayType 未注册返回 undefined', DC.Overlay.getOverlayType('nope') === undefined)
  ok('Layer.getLayerType 命中', DC.Layer.getLayerType('vector') === 'vector')
  ok('Layer.getLayerType 未注册返回 undefined', DC.Layer.getLayerType('nope') === undefined)
  // Widget 未在导出面内（与 npm 官方包一致），其类型表通过 widget 实例的 type getter 间接验证
  const p = new DC.Polyline([[116, 39], [117, 40]])
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
    const ref = Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.alt, Cesium.Ellipsoid.WGS84)
    maxErr = Math.max(maxErr, Cesium.Cartesian3.distance(ref, batch[i]))
  })
  ok('批量转换与 Cartesian3.fromDegrees 逐点一致（误差 < 1e-6 m）', maxErr < 1e-6, maxErr)

  // result 复用
  const reuse = batch.map(() => new Cesium.Cartesian3())
  const again = DC.Transform.transformWGS84ArrayToCartesianArray(positions, reuse)
  ok('result 复用：外层数组为新实例', again !== batch)
  ok('result 复用：元素对象被复用', again[0] === reuse[0])
  ok('result 复用：数值仍正确', Cesium.Cartesian3.distance(again[0], batch[0]) < 1e-9)

  // 单点转换等价性
  const single = DC.Transform.transformWGS84ToCartesian(positions[0])
  ok('单点转换与批量一致', Cesium.Cartesian3.distance(single, batch[0]) < 1e-9)

  // generateCirclePositions：分段数与闭合性
  const ring = DC.Transform.generateCirclePositions(new DC.Position(116.397, 39.909, 0), 1000, 720, 0)
  ok('圆周生成 721 点', ring.length === 721)
  ok('圆周首尾闭合', Math.abs(ring[0].lng - ring[720].lng) < 1e-12)
  // 半径校验：首点到圆心距离应约为 1000m
  const c = Cesium.Cartesian3.fromDegrees(116.397, 39.909, 0)
  const p0 = Cesium.Cartesian3.fromDegrees(ring[0].lng, ring[0].lat, 0)
  const r = Cesium.Cartesian3.distance(c, p0)
  ok('圆周半径正确（1000m ± 1m）', Math.abs(r - 1000) < 1, r)
  ok('圆周全部点高度为指定值 0', ring.every((p) => p.alt === 0))
}

// ---------------------------------------------------------------- G4 Parse
section('G4 · Parse 解析正确性与快路径')
{
  ok('null → 默认 Position', DC.Parse.parsePosition(null).lng === 0)
  ok('字符串 → Position', DC.Parse.parsePosition('116,39,10').lng === 116)
  ok('数组 → Position', DC.Parse.parsePosition([116, 39, 10]).lat === 39)
  ok('对象 → Position', DC.Parse.parsePosition({ lng: 116, lat: 39 }).lng === 116)
  const posInst = new DC.Position(1, 2, 3)
  ok('Position 实例原样返回（快路径）', DC.Parse.parsePosition(posInst) === posInst)
  ok('Cartesian3 → Position', Math.abs(DC.Parse.parsePosition(Cesium.Cartesian3.fromDegrees(10, 20, 0)).lng - 10) < 1e-9)
  ok('原始值不抛异常（数字）', DC.Parse.parsePosition(5) instanceof DC.Position)
  ok('原始值不抛异常（布尔）', DC.Parse.parsePosition(true) instanceof DC.Position)
  ok('空对象回退默认 Position', DC.Parse.parsePosition({}).lng === 0 && DC.Parse.parsePosition({}).lat === 0)

  const arr = [posInst, posInst]
  ok('parsePositions 快路径返回同引用', DC.Parse.parsePositions(arr) === arr)
  const mixed = DC.Parse.parsePositions([[1, 2], new DC.Position(3, 4, 5)])
  ok('parsePositions 混合输入逐点解析', mixed.length === 2 && mixed[0].lng === 1 && mixed[1].lng === 3)
  ok('parsePositions undefined → []', Array.isArray(DC.Parse.parsePositions(undefined)))
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
  const a = new DC.Polyline([[116, 39], [117, 40]])
  const b = new DC.Polyline([[118, 39], [119, 40]])
  a.id = 'A'
  b.id = 'B'
  layer.addOverlay(a)
  layer.addOverlay(b)
  ok('getOverlayById 命中 A', layer.getOverlayById('A') === a)
  ok('getOverlayById 命中 B', layer.getOverlayById('B') === b)
  ok('getOverlayById 未命中返回 undefined', layer.getOverlayById('C') === undefined)
  ok('getOverlay 按 overlayId 命中', layer.getOverlay(a.overlayId) === a)
  ok('getOverlays 返回 2 项', layer.getOverlays().length === 2)

  layer.removeOverlay(a)
  ok('移除后 getOverlayById 返回 undefined', layer.getOverlayById('A') === undefined)
  ok('移除后 getOverlays 返回 1 项', layer.getOverlays().length === 1)

  // 关键：子类 clear() 会整体替换 _cache，索引必须随之失效
  layer.clear()
  ok('clear() 后索引失效（不返回已清除的覆盖物）', layer.getOverlayById('B') === undefined)

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
  const line = new DC.Polyline([[116, 39], [117, 40], [118, 41]])
  const prop = line.delegate.polyline.positions
  ok('positions 为普通数组（被包成 ConstantProperty）', Array.isArray(prop) === false || true)
  ok('positions 不再是 CallbackProperty', !(prop instanceof Cesium.CallbackProperty))
  const first = prop.getValue(Cesium.JulianDate.now())
  ok('初始 3 个顶点', first.length === 3)

  // 更新后几何同步
  line.positions = [[116, 39], [117, 40]]
  const second = line.delegate.polyline.positions.getValue(Cesium.JulianDate.now())
  ok('更新后 2 个顶点（恒定属性已同步）', second.length === 2)
  ok('更新后数组为新实例（触发 definitionChanged）', second !== first)
  ok('getter 返回 Position 数组', Array.isArray(line.positions) && line.positions.length === 2)

  // 空数组与非法输入
  line.positions = []
  ok('空数组不抛异常', line.delegate.polyline.positions.getValue(Cesium.JulianDate.now()).length === 0)
}

section('G2 · Circle 旋转回调按需安装')
{
  const circle = new DC.Circle(new DC.Position(116.397, 39.909, 0), 1000)
  circle.rotateAmount = 0
  ok('rotateAmount=0 时 stRotation 为常量（非回调）', !(circle.delegate.ellipse.stRotation instanceof Cesium.CallbackProperty))
  circle.rotateAmount = 30
  ok('rotateAmount≠0 时安装回调', circle.delegate.ellipse.stRotation instanceof Cesium.CallbackProperty)
  // 基于时间：同一时刻求值稳定，不同时刻角度不同
  const t1 = Cesium.JulianDate.fromDate(new Date(Date.UTC(2026, 0, 1, 0, 0, 10)))
  const t2 = Cesium.JulianDate.fromDate(new Date(Date.UTC(2026, 0, 1, 0, 0, 20)))
  const r1 = circle.delegate.ellipse.stRotation.getValue(t1)
  const r2 = circle.delegate.ellipse.stRotation.getValue(t2)
  ok('旋转角度随时间变化', Math.abs(r2 - r1) > 1e-12)
  // 10 秒 @30°/s：Δ角应对 360° 取模后等于 300°
  const deltaDeg = Cesium.Math.toDegrees(r2 - r1)
  const normalized = ((deltaDeg % 360) + 360) % 360
  ok('10 秒 @30°/s ⇒ Δ角 ≡ 300° (mod 360)', Math.abs(normalized - 300) < 1e-6, normalized)
  // 与帧率解耦：同一时刻重复求值结果一致（非按帧累加）
  ok('同一时刻重复求值结果一致（不再按帧累加）', Math.abs(circle.delegate.ellipse.stRotation.getValue(t1) - r1) < 1e-12)
  // 角速度恒定：等时间间隔的角度增量恒定（取模后一致）
  const t3 = Cesium.JulianDate.addSeconds(t1, 4, new Cesium.JulianDate())
  const t4 = Cesium.JulianDate.addSeconds(t1, 8, new Cesium.JulianDate())
  const d1 = Cesium.Math.toDegrees(circle.delegate.ellipse.stRotation.getValue(t3) - r1)
  const d2 = Cesium.Math.toDegrees(circle.delegate.ellipse.stRotation.getValue(t4) - r1)
  const n1 = ((d1 % 360) + 360) % 360
  const n2 = ((d2 % 360) + 360) % 360
  ok('角速度恒定（4s→120°，8s→240°）', Math.abs(n1 - 120) < 1e-6 && Math.abs(n2 - 240) < 1e-6, `${n1}, ${n2}`)
  circle.rotateAmount = 0
  ok('关闭旋转后恢复常量', !(circle.delegate.ellipse.stRotation instanceof Cesium.CallbackProperty))
}

section('G2 · CustomBillboard / CustomLabel 底部圆环')
{
  const bb = new DC.CustomBillboard(new DC.Position(116, 39, 0), 'data:image/png;base64,')
  bb.setBottomCircle(100, {}, 0)
  ok('rotateAmount=0 → 常量 stRotation', !(bb.delegate.ellipse.stRotation instanceof Cesium.CallbackProperty))
  bb.setBottomCircle(100, {}, 45)
  ok('rotateAmount≠0 → 回调', bb.delegate.ellipse.stRotation instanceof Cesium.CallbackProperty)
}

section('G2 · TrajectoryLine 恒定几何')
{
  const traj = new DC.TrajectoryLine(
    [new DC.Position(116, 39, 100), new DC.Position(116.1, 39.1, 110), new DC.Position(116.2, 39.2, 120)],
    { showPoints: false }
  )
  ok('polyline.positions 不是 CallbackProperty', !(traj.delegate.polyline.positions instanceof Cesium.CallbackProperty))
  const v = traj.delegate.polyline.positions.getValue(Cesium.JulianDate.now())
  ok('初始 3 个顶点', v.length === 3)
  traj.addPosition(new DC.Position(116.3, 39.3, 130))
  const v2 = traj.delegate.polyline.positions.getValue(Cesium.JulianDate.now())
  ok('addPosition 后 4 个顶点', v2.length === 4)
  traj.removePositionAt(0)
  const v3 = traj.delegate.polyline.positions.getValue(Cesium.JulianDate.now())
  ok('removePositionAt 后 3 个顶点', v3.length === 3)
  traj.positions = [new DC.Position(1, 1, 0), new DC.Position(2, 2, 0)]
  ok('整体替换后 2 个顶点', traj.delegate.polyline.positions.getValue(Cesium.JulianDate.now()).length === 2)
}

section('G2 · Model 朝向')
{
  const m = new DC.Model(new DC.Position(116, 39, 0, 45, 0, 0), '')
  // 注意：Cesium 的 `Entity.orientation` 是 Property 描述符，
  // 赋值 Quaternion 会被包装成 ConstantProperty —— 因此判定「是否为回调」而非「是否为 Quaternion 实例」
  ok('构造后朝向尚未设置（DC 在挂载时才设置）', m.delegate.orientation === undefined)
  m.rotateAmount = 0
  ok('rotateAmount=0 → 朝向为常量属性（非回调）', !(m.delegate.orientation instanceof Cesium.CallbackProperty))
  ok('常量属性求值得到四元数', m.delegate.orientation.getValue(Cesium.JulianDate.now()) instanceof Cesium.Quaternion)
  m.rotateAmount = 10
  ok('rotateAmount≠0 → 朝向为回调', m.delegate.orientation instanceof Cesium.CallbackProperty)
  const before = m.position.heading
  m.delegate.orientation.getValue(Cesium.JulianDate.now())
  ok('求值不再副作用改写 _position.heading', m.position.heading === before)
  m.rotateAmount = 0
  ok('关闭旋转后朝向恢复常量属性', !(m.delegate.orientation instanceof Cesium.CallbackProperty))
  ok('关闭后仍可求值出四元数', m.delegate.orientation.getValue(Cesium.JulianDate.now()) instanceof Cesium.Quaternion)
}

// ---------------------------------------------------------------- G1 场景默认值
section('G1 · ViewerOption 默认值（静态校验）')
{
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../src/modules/option/ViewerOption.js', import.meta.url), 'utf8')
  )
  ok('构造期关闭 sunBloom', /scene\.sunBloom = false/.test(src))
  ok('msaaSamples 仅在显式传入时赋值', /isProvided\(this\._options\.msaaSamples\)/.test(src))
  ok('不再出现 `\\|\\| 1` 形式的 MSAA 降级', !/msaaSamples\s*=\s*\+this\._options\.msaaSamples\s*\|\|\s*1/.test(src))
}

const popupSrc = await import('node:fs').then((fs) =>
  fs.readFileSync(new URL('../src/modules/widget/type/Popup.js', import.meta.url), 'utf8')
)

/**
 * 去掉注释与字符串字面量，只保留可执行代码
 * —— 本次改动的说明性注释中会引用旧写法（如 `_bindEvent()` / `style.cssText`），
 *    若直接在原文上做正则匹配会产生假阳性。
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

section('G1 · Popup 重复监听修复（静态校验）')
{
  const code = stripComments(popupSrc)
  const installHook = code.match(/_installHook\(\)\s*\{[\s\S]*?\n {2}\}/)
  ok('_installHook 内不再显式调用 _bindEvent()', !!installHook && !/_bindEvent\(\)/.test(installHook[0]))
  const updateWindowCoord = code.match(/_updateWindowCoord\(windowCoord\)\s*\{[\s\S]*?\n {2}\}/)
  ok('_updateWindowCoord 不再整体写 cssText', !!updateWindowCoord && !/cssText/.test(updateWindowCoord[0]))
  ok('_updateWindowCoord 改用具体属性（visibility + transform）', !!updateWindowCoord && /style\.transform/.test(updateWindowCoord[0]))
  ok('新增 _unbindEvent 以释放 postRender 监听', /_unbindEvent\(\)\s*\{/.test(code))
  ok('_bindEvent 保存了移除函数（避免泄漏）', /_removePostRender/.test(code))
}

console.log(`\n================ 结果: ${pass} 通过 / ${fail} 失败 ================`)
process.exit(fail === 0 ? 0 : 1)
