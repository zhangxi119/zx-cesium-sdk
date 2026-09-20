# DC 库层能力下沉 · 库侧调整报告（zx-cesium-sdk）

> **报告范围**：2026-09-20 这轮「把应用层通用性能/画质能力下沉到 `zx-cesium-sdk`」在**库仓库**内的全部改动。
> 应用层侧的同批改动见 `ms-fe-cacs/DC_CAPABILITY_SINK_REPORT.md`。
>
> | 项         | 值                                                                                               |
> | ---------- | ------------------------------------------------------------------------------------------------ |
> | 提交状态   | 本报告所述改动**已由用户提交为 `2503db2`**（`feat: 线体、扫描圆性能调优`，16 文件 / +1709 / −5） |
> | 工作区残留 | 仅 `package.json` 的版本号（`1.0.8` → `1.0.9`）未提交                                            |
> | 发布状态   | `zx-cesium-sdk@1.0.9` 已于 2026-09-20 07:42 UTC 发布到 npm，应用层已回切 `^1.0.9`                |

---

## 1. 结论速览

| 项           | 结果                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 验证套件     | `pnpm verify:perf` = **147 + 67 = 214 断言 / 0 失败**（直测 `dist` 产物）                                                               |
| 构建产物     | `dist/index.js` = **510,485 B**（SHA256 `2154249791B827272D4BB37A7A87A37DBB572770DB337D4FC2C2EEBE9047490A`）；`dc.min.js` = 6,530,267 B |
| 示例页       | 3 个新增示例页在**真实 Chrome** 中逐个加载校验：无运行时报错、面板实测值与预期一致                                                      |
| 发布物一致性 | npm 上 `1.0.9` 的 `dist/index.js` 与本地产物 **SHA256 完全一致** → 全部验证结论对发布包同样成立                                         |
| 默认行为     | 所有新增能力**默认关闭 / 默认不改变既有行为**（D-16）                                                                                   |

---

## 2. 新增/变更的公共 API

| API                                       | 类型                     | 默认        | 说明                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CustomBillboard.pixelDensity`            | `number \| boolean`      | `1`（关闭） | 图标纹理密度。`true` = 按 `devicePixelRatio`；`≤ 1`/非法 = 关闭；上限 `4`。开启后 `width/height` 放大 density 倍、`scale = 1/density`（视觉尺寸逐像素不变），并**按目标物理分辨率预栅格化图标** |
| `CustomBillboard.icon`（setter）          | —                        | —           | 换图标后**自动重新预栅格化**（密度开启时），使用方按状态换图不会退回模糊                                                                                                                        |
| `Viewer.resolvePixelDensity()`            | `number`                 | —           | 推荐密度 = `devicePixelRatio ÷ scene.pixelRatio`，恒 `≥ 1`、`≤ 4`（绘制缓冲区已是物理像素时返回 1）                                                                                             |
| `CustomBillboard.pixelDensity` 缓存       | —                        | —           | 预栅格化按「url + 尺寸」缓存**任务 Promise**：并发/同 tick 请求共享任务，失败结果同样缓存（不重试）                                                                                             |
| `Util.clampLineWidth(width, range?)`      | `number`                 | `[1, 12]`   | 线宽规整；**不做像素比换算**（Cesium `width` 已是 CSS 像素语义）；非法入参落到下限                                                                                                              |
| `Polyline.setStyle({ clampLineWidth })`   | `boolean`                | `false`     | `true` 时把本次 `width` 钳到 `[1, 12]`（`width < 1` 会让 Cesium 整条不绘制）                                                                                                                    |
| `Polyline.setStyle({ strictLineWidth })`  | `boolean`                | `false`     | `true` 时**否决**钳制（优先级更高，逃生舱）。两个开关都会被消费掉、不透传给 Cesium                                                                                                              |
| `Viewer.getPerformanceSnapshot()`         | `object`                 | —           | 直读 Cesium 原生对象上的**真实**渲染参数与绘制规模（`msaaSamples`/`fxaa`/大气层/`pixels`/`drawCommands`…）                                                                                      |
| `Viewer.setRenderQuality(options)`        | `Viewer`                 | —           | 把档位写入 Cesium 原生对象，**不经过 `setOptions` 整体重放**（避免 `msaaSamples` 被重置为 1）                                                                                                   |
| `Viewer.getRenderQuality()`               | `{requested, effective}` | —           | 期望值 + 真实生效值对照，用于定位「档位没生效」                                                                                                                                                 |
| `DC.selfCheck({ viewer })`                | `{ok, warnCount, items}` | —           | 断言使用方收益所依赖的库默认值是否仍然成立；只读、绝不抛错、无法判定标 `skip`                                                                                                                   |
| `DC.IntervalGate` / `DC.TrailingThrottle` | 函数/类                  | —           | 采样闸门 + 尾帧保证节流（经 `utils/index.js` + `modules/index.js` 导出）                                                                                                                        |

---

## 3. 文件级变更清单

### 3.1 本轮（2026-09-20 会话）新增/修改

| 文件                                                | 规模 | 内容                                                                                                                                                     |
| --------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/overlay/custom/CustomBillboard.js`     | +172 | `pixelDensity` 全套机制（密度换算 + `scale` 还原 + 预栅格化 + 缓存 + 失败回退）；**本轮追加** C-10（`set icon` 重栅格化）与 C-11（缓存改存任务 Promise） |
| `src/modules/overlay/vector/Polyline.js`            | +27  | `setStyle` 的 `clampLineWidth` / `strictLineWidth` opt-in 开关；两个开关都会被消费掉                                                                     |
| `src/modules/utils/Util.js`                         | +33  | 新增 `Util.clampLineWidth`（默认 `[1,12]`，支持自定义区间，非数值落到下限）                                                                              |
| `verify/perf-verify.mjs`                            | +272 | 新增「B2/B3」21 项、「A2」13 项断言（含换图标重栅格化、同 tick 批量共享任务、开关不透传等）                                                              |
| `examples/vector/polyline_clamp_width.html` + `.md` | 新增 | A-2 示例与文档（同屏 6 条线对照钳制/不钳制/逃生舱，并回读实体真实线宽）                                                                                  |
| `examples/vector/point_icon_density.html` + `.md`   | 新增 | B-2/B-3 示例与文档（`1/2/4/true` 四种密度对照 + 运行期换图标演示）                                                                                       |
| `examples/setting/render_quality.html` + `.md`      | 新增 | B-1 + A-3 + A-4 示例与文档（档位按钮 + 期望值/真实值/绘制规模/自检明细面板）                                                                             |
| `examples/list.js`                                  | +12  | 注册上述 3 个示例页入口（矢量要素 2 项 + 场景设置 1 项）                                                                                                 |

### 3.2 上批已就绪（本轮核验、未再改动）

| 文件                                                 | 规模 | 内容                                                                                       |
| ---------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| `src/modules/viewer/Viewer.js`                       | +184 | `getPerformanceSnapshot` / `setRenderQuality` / `getRenderQuality` / `resolvePixelDensity` |
| `src/modules/utils/Throttle.js`                      | +199 | `IntervalGate` / `TrailingThrottle`（新增文件）                                            |
| `src/modules/self-check/index.js`                    | +155 | `selfCheck({ viewer })`（新增文件）                                                        |
| `src/modules/index.js`、`src/modules/utils/index.js` | ±5   | 导出新增能力                                                                               |

---

## 4. 关键实现要点

### 4.1 图标清晰度（B-2 + B-3）：一个开关承载两层根因

- **第一层**：绘制缓冲区可能只有 CSS 尺寸（`useDevicePixelRatio: false`）→ 1 个纹理像素铺到 2×2 物理像素 → 发虚。
  解法：`width/height` 放大 density 倍 + `scale = 1/density` 还原视觉尺寸。
- **第二层**：**Cesium 从不按 `billboard.width/height` 重新栅格化图片**（见 `Resource._Implementations.loadImageElement`），
  纹理永远来自 `<img>` 固有尺寸（本项目图标 82×69 / 98×93 / 60×57）。
  解法：密度 > 1 时把图标按「视觉尺寸 × 密度」画进 canvas，以 data URL 写回 `billboard.image`。
- **时序**：应用层必须在 `addTo` **之后**设置 `pixelDensity`（`_mountedHook` 会按视觉尺寸重写 `width/height`
  并写回原图标）；库层在 `_mountedHook` 内也补一次，作为第二道保险。

### 4.2 C-10：换图标后重新预栅格化（本轮修复）

`set icon` 原本只写 `billboard.image = 原图`，而原图固有尺寸远小于当前纹理尺寸（82×69 → 164×138）→
**刚修好的清晰度被立刻抹掉**。真实路径：无人机按风险等级换色、设备上/下线换图标。

修复：`set icon` 内补 `this._upgradeIcon()`（密度 ≤ 1 时该函数自身早退，默认行为不变）。

### 4.3 C-11：预栅格化缓存改存「任务 Promise」（本轮修复，真机示例暴露）

原实现先往缓存写**占位 `null`**、再异步填充结果 → 同一 tick 内创建的第 2..N 个同图标标记命中占位、
拿到 `null` 后**永久停留在原图**。而「一次数据推送批量创建设备/无人机标记」正是应用主路径。

修复：缓存改存任务 Promise，同 key 的并发/同 tick 请求共享同一任务（去重仍成立；
失败结果同样缓存、不重试）。**这个缺陷单测与 `verify:perf` 都发现不了**，是靠示例页把
实测值打印到面板上（`density=true … 预栅格化=否`）才看出来的。

### 4.4 A-2：线宽语义保护（本轮新增，opt-in）

`width < 1` 会让 `PolylineVS` 走 `if (width < 1.0) { show = 0.0; }` —— **整条线不绘制**，属静默异常；
`width` 过大会生成极宽四边形、遮挡地图并消耗填充率。开关语义（用户确认，D-28）：

| 写入 `width` | 开关                                 | 实体实际 `width`                |
| ------------ | ------------------------------------ | ------------------------------- |
| `0.5`        | 无                                   | `0.5`（不绘制，与既有版本一致） |
| `0.5`        | `clampLineWidth`                     | `1`                             |
| `100`        | `clampLineWidth`                     | `12`                            |
| `3.5`        | `clampLineWidth`                     | `3.5`（区间内不取整）           |
| `0.5`        | `clampLineWidth` + `strictLineWidth` | `0.5`（逃生舱生效）             |

---

## 5. 验证证据

```powershell
cd E:\projects\zx-cesium-sdk
pnpm build            # 或 build:node；示例页需要 dc.min.js 时用 build
pnpm verify:perf      # → 147 通过 / 0 失败；67 通过 / 0 失败
```

- `pnpm verify:perf`：**214 断言 0 失败**（其中「B2/B3」21 项 +「A2」13 项为本轮新增）。
- 示例页真机校验：`polyline_clamp_width.html` / `point_icon_density.html` / `render_quality.html`
  逐个用真实 Chrome（SwiftShader）加载，断言「无运行时报错 + 面板实测值与预期一致」，三页全通过。
  - 实测样例：`density=2 → 纹理=96×96、scale=0.5、预栅格化=是`；`density=true → 密度=2`；
    `换图标演示 → 预栅格化=是`（C-10 生效）；`width=0.5 + clampLineWidth → 实体实际 width=1`。

---

## 6. 决策留痕（库侧相关）

| D    | 决策                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D-16 | 库层新增能力**默认关闭 / 默认不改变既有行为**；A-2 线宽钳制因此为 opt-in                                                                       |
| D-19 | 档位**数值**不入库（库层只提供机制），应用层保留预设与 auto 策略                                                                               |
| D-25 | **B-2 与 B-3 在库层合为一个开关**：`pixelDensity` 一次承载密度换算 + `scale` 还原 + 预栅格化 + 缓存 + 失败回退                                 |
| D-28 | A-2 采用**每处 opt-in**语义（不传＝不动；`clampLineWidth`＝钳制；`strictLineWidth`＝否决且优先）。**不做全局 `config` 开关**，避免全局可变状态 |
| D-29 | 预栅格化缓存存**任务 Promise** 而非结果占位（C-11 的根因与修法）                                                                               |
| D-30 | **库层新增能力必须产出可运行示例并真机校验**：C-10/C-11 两个真实缺陷正是靠这一步暴露的                                                         |

---

## 7. 未决项

| 编号 | 项                                                                      | 说明                                                                                                                                                           |
| ---- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-6  | `CustomBillboard.set size` 在密度**关闭**时也会写入 `scale = 1`         | 严格意义违反 D-16「默认行为不变」（写入值等同 Cesium 默认值，实测对应用层零影响）。若要严格化，可在 `_applySize` 中加「仅密度 > 1 时改写 scale」并配套状态复位 |
| C-8  | 预栅格化缓存**无公开清理入口**                                          | 已确认**有界**：按「url + 尺寸」复用、不随挂载次数增长；如确需释放，需新增公开 API（当前只能整体销毁场景）                                                     |
| —    | `Polyline.setStyle` 会 `delete style.positions`（改动调用方传入的对象） | 既有行为，本轮未改                                                                                                                                             |

---

## 8. 发布与安装

```powershell
# 发布（1.0.9 已按此流程完成）
npm publish                                   # registry = https://registry.npmjs.org/
Invoke-RestMethod "https://registry.npmjs.org/zx-cesium-sdk/1.0.9" | Select-Object version

# 消费方安装
pnpm add zx-cesium-sdk@^1.0.9
```

> ⚠️ **`npm view` 可能给出过旧结果**：本轮回切时 `npm view zx-cesium-sdk versions` 一度只到 `1.0.8`，
> 而直连 registry 已存在 `1.0.9`。判定「是否已发布」请直连 registry 或稍后重查。
