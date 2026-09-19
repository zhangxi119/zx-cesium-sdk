# Change Log

### 1.0.8 - 2026-09-19

#### 性能优化 ⚡（深度优化，详见 `DC_LIB_PERF_PLAN.md`）

**渲染默认值**
- **`sunBloom` 默认关闭**：Cesium 默认 `scene.sunBloom = true`，每帧执行 2 个全分辨率泛光 pass。
  现于 `ViewerOption` 构造期关闭；需要时用 `setOptions({ showSunBloom: true })` 开启。
- **`msaaSamples` 不再被强制降级**：旧实现 `+options.msaaSamples || 1` 在未传参时会把
  Cesium 默认的 **4x MSAA 降为 1（关闭）**；现仅在显式传入时覆盖。
- **修复 `Popup` 的 `postRender` 监听重复注册**：`_installHook()` 中
  `this.enable = true` 已经触发过 `_bindEvent()`，随后又显式调用一次，
  导致弹框可见时每帧执行两遍定位计算与 DOM 写入。
- **`HawkeyeMap` 不再无条件修改相机灵敏度**：原在 `_installHook()`（**无条件执行**）
  中把 `camera.percentageChanged` 从 Cesium 默认的 `0.5` 改为 `0.01`（敏感度 50 倍），
  即使从未启用鹰眼图也会生效。现改为启用时设置、禁用时恢复。

#### Breaking Changes 📣（行为修正）

- **`ViewerOption.setOptions()` 语义变更**：由「累积合并 + **重放全部 setter**」改为
  「累积合并 + **只应用本次传入的键**」。
  旧行为会把未传入的项重置为默认值（典型症状：调用一次 `setOptions` 就把
  `msaaSamples` 重置为 1、大气层/太阳/月亮重置为 `true`、`resolutionScale` 重置为 1）。
- **`Util.merge()` 只拷贝自有属性**（原 `for...in` 会连继承属性一起拷贝）。
- **`MouseEvent` 的 `position` / `wgs84Position` 默认不再计算**（见下）。

#### 性能优化 ⚡（几何与热路径）

- **`Polyline.positions` 改为恒定数组**（原为非恒定 `CallbackProperty`）。
  Cesium 会把非恒定属性判定为**动态几何**，每帧执行
  `primitives.removeAndDestroy(primitive)` + `primitives.add(new Primitive(...))`
  —— 即**每帧销毁并重建 GPU 顶点缓冲**。这是三维稳态帧率的主要瓶颈。
  现改为普通数组（包装为 `ConstantProperty`），几何仅在数据变更时构建一次。
- **`Circle.rotateAmount` / `CustomBillboard.setBottomCircle` / `CustomLabel.setBottomCircle`**：
  `rotateAmount` 为 0（默认）时不再安装回调，几何保持静态；
  需要旋转时改为**基于时间**计算（原按**帧**累加，转速会随帧率变化）。
- **`TrajectoryLine`**：线的 `positions` 与每个分点的 `position`/`width`/`height`
  全部改为恒定属性（原一条 600 点轨迹会产生 1800 个逐帧求值的回调）。
- **`Model.rotateAmount`**：不再副作用式改写 `_position.heading`；关闭旋转时移除回调。
- **`Track`（历史轨迹）**：路径 `positions` 改为恒定属性。
  原实现即使在**回放结束后**仍每帧重建几何。
- **`MouseEvent`**：
  - 不再每次鼠标移动调用 `scene.pickPosition()`（GPU 深度回读，**阻塞渲染流水线**）；
    新增 `enableMouseMovePickPosition`（默认 `false`）按需开启。请改用
    `wgs84SurfacePosition`（纯 CPU 椭球拾取）。
  - `_adjustPosition` 不再每次调用 `getBoundingClientRect()`（强制同步布局），改为按尺寸缓存；
    且 `_getMouseInfo` 不再重复计算两次。
  - `_raiseEvent` 增加**订阅者前置短路**：未拾取到目标且 viewer 无订阅者时直接返回，
    不再构造目标信息（跳过 `getLayers()` 分配与线性查找）。
  - `_registerEvent` 只为 `MouseEventType` 中实际派发的类型注册动作。
- **`Viewer.getLayers()` / `getLayer()` / `hasLayer()`**：改为增量维护扁平数组与 `Map` 索引。
  旧实现每次调用都做「双重 `Object.keys` + 逐层 push」，而它位于每次鼠标事件的路径上。
- **`Layer.getOverlayById()`**：由 O(n) 线性扫描改为 O(1) 索引（并对子类
  `clear()` 整体替换 `_cache` 的情况做了索引失效处理）。
- **`Transform`**：批量坐标转换改为复用临时 `Cartographic` 与出参数组；
  `generateCirclePositions` 全程零中间分配（原每点分配 3 个临时对象，720 段即 2160 次）。
- **`Parse.parsePosition`**：`Position` 实例走快路径；去掉 `Object()` 装箱与两次
  `hasOwnProperty` 原型查找（`parsePositions` 对每个点调用它）。
- **`Util.isPromise`**：不再用 `Promise.resolve(obj) == obj`（每次分配 Promise）；
  改为特征判断。该方法位于 `Overlay.show` setter，属显隐切换热路径。
- **`Util.uuid`**：改为自增序号 + 随机后缀，保留 `D-` 前缀格式。
- **类型查找**：`Overlay` / `Layer` / `Widget` 的 `getXxxType()` 去掉 `toLocaleUpperCase()`
  （locale 敏感且明显慢于 `toUpperCase`），改为注册时预建的小写直查表。
- **`ContextMenu`**：`ScreenSpaceEventHandler` 由安装时创建改为启用时创建、禁用时销毁
  （原实现会让每个 Viewer 都多出一个事件处理器，与 `MouseEvent` 重复分发鼠标事件）。

#### Features ✨
- `Viewer` 新增 `widgets` / `tools` 选项白名单，可跳过不需要的控件以降低启动开销：
  ```js
  new DC.Viewer('container', {
    widgets: ['popup', 'tooltip'],
    tools: ['drawTool', 'editTool']
  })
  ```
  未传入时保持原有全集行为。

#### Tests ✅
- 新增 `npm run verify:perf`：基于 jsdom 的运行时正确性验证脚本
  （83 项断言，覆盖上述全部改动）。

### 4.2.0 - 2025-02-09

#### Breaking Changes 📣
- 升级 @cesium/engine 到 13.1.0 版本

#### Fixes 🔧
- 移除全局config 上下文

### 4.1.1 - 2025-01-05

#### Breaking Changes 📣
- 紧急发布，添加分析模块

### 4.1.0 - 2025-01-05

#### Breaking Changes 📣
- 升级 @cesium/engine 到 13.0.0 版本

#### Fixes 🔧
- 修复地图配置无法使用的问题
- 修复波纹圆动画的问题

### 4.0.0

#### Breaking Changes 📣

- 修改底层打包方式，修复使用 node 模式后，出现 DC 是无法扩展的问题 [#199](https://github.com/dvgis/dc-sdk/issues/199)
- 升级 @cesium/engine 到 12.0.0 版本
- 移除 `__namespace` 全局变量，建议使用 `getLib` 获取所需的第三方框架模块
- 移除扩展模块 Viewer 类，将使用 `CesiumWidget` 作为场景构建类

#### Additions 🎉

- 添加天际线分析功能
- Plot 中完善锚点样式功能
- 开放部分 Cesium 底层原生的类

#### Fixes 🔧

- 修复鼠标拾取问题

### 3.5.0

#### Breaking Changes 📣

- 升级 @cesium/engine 到 9.1.0 版本
- overlay 中的 Ellipsoid 实体类变更为 Sphere 实体类,Ellipsoid 为 Cesium.Ellipsoid

#### Additions 🎉

- 添加自定义 TilingScheme，用于通过切图原点和比例尺添加瓦片
- 添加启用控制覆盖物移入和移出监听参数
- 添加默认 Cesium 裁剪面

#### Fixes 🔧

- 修复场景分割组件添加 3dtiles 和 baselayer 的问题

### 3.4.0 - 2024-04-04

#### Fixes 🔧

- 优化 Node 模式下引入错误的问题

### 3.3.0 - 2024-03-21

#### Breaking Changes 📣

- 升级 @cesium/engine 到 8.0.0 版本
- 优化打包方式，移除 rollup 的打包

#### Fixes 🔧

- 优化聚合图层计算间隔
- 解决栅格瓦片删除销毁问题
- 解决底图删除问题
- 解决单图片瓦片无法加载的问题

### 3.2.0 - 2023-09-25

#### Breaking Changes 📣

- 升级 @cesium/engine 到 4.0.0 版本
- 框架添加开发模式

#### Additions 🎉

- 添加 tileset 钩子事件的支持
- 添加 RasterTileLayer

#### Fixes 🔧

- 优化相机当前位置计算方式

### 3.1.0 - 2023-08-06

#### Breaking Changes 📣

- 升级 @cesium/engine 到 3.0.2 版本
- 文档搭建框架从 VuePress 变换至 VitePress

#### Additions 🎉

- 添加聚合图层鼠标事件的支持

#### Fixes 🔧

- 优化组件初始化功能，能够与第三方框架兼容
- 优化坐标转换功能

### 3.0.1 - 2023-07-30

#### Fixes 🔧

- 优化测量功能
- 优化谷歌地图
- 优化天气效果功能
- 优化中文文档
- 优化示例

### 3.0.0 - 2023-07-23

#### Breaking Changes 📣

- 升级 @cesium/engine 到 3.0.1 版本
- 框架依赖从 Cesium 换成 @cesium/engine，@cesium/widget 库不再使用，只同步`Viewer`相关代码
- 重构框架打包方式, `iife` 和 `node` 两种方式生成单独的框架包
- 重构框架库的目录结构
- 升级材质 `glsl` 到 3.0
- 移除`mapv`图层和`s3m`图层，同时移除了相应的依赖库
- 移除全局函数 `init`、`mixin`、`use`
- 移除`Namespace`全局属性，可通过全局函数`getLib`获取第三方库
- 修改框架 `cdn` 和 `node` 的引入方式，框架使用一个整体包的方式进行加载
- 修改框架入口函数，将使用`ready().then()`作为框架入口
- 修改效果类构造函数，需将`viewer`作为参数传递
- 修改场景 dom 结构，移除了无用的 dom

#### Additions 🎉

- 框架库添加示例代码
- 框架库添加文档代码
- 添加经纬度图层

#### Fixes 🔧

- 优化聚合图层，使用第三方库 `supercluster` 进行聚合计算
- 优化热区图层
- 修复升级 Cesium 框架导致的一系列问题

### 2.17.0 - 2022-10-29

#### Breaking Changes 📣

- 升级 Cesium 到 1.98.1 版本
- 移除 ModelCollectionPrimitive

#### Fixes 🔧

- 修复 locationbar 鼠标移动的坐标错误
- 修复 transform 中坐标转换的问题
- 修复瓦片蒙层问题

### 2.16.2 - 2022-09-13

#### Additions 🎉

- 开放部分 Cesium 原生类

#### Fixes 🔧

- 优化场景导出功能
- 优化地形加载功能[#126](https://github.com/dvgis/dc-sdk/issues/126)

### 2.16.1 - 2022-08-21

#### Additions 🎉

- 添加可视域的混合度参数

#### Fixes 🔧

- 优化 Model Instance
- 优化 heading 函数

### 2.16.0 - 2022-08-14

#### Breaking Changes 📣

- 升级 Cesium 到 1.96.0 版本
- 舍弃 init 函数
- 修改 Cesium 引入方式

#### Fixes 🔧

- 优化 parabola 函数，计算结果添加结束点
- 优化 name space 模块的使用方式
- 修复 CDN 方式下，重复使用 use 导致框架无法使用的问题
- 修复升级 Cesium 产生的问题

### 2.15.0 - 2022-07-16

#### Breaking Changes 📣

- 升级 Cesium 到 1.95.0 版本

#### Additions 🎉

- 添加 flyToBounds 和 zoomToBounds 函数
- 添加代码提示模块
- 添加场景渲染错误订阅事件

#### Fixes 🔧

- 优化定位栏海拔数值[#109](https://github.com/dvgis/dc-sdk/issues/109)
- 修复历史轨迹多次恢复时间错误的问题
- 修复历史轨迹播放结束显示错误的问题[#107](https://github.com/dvgis/dc-sdk/issues/107)
- 修复标绘编辑时锚点数量错误和无法设置大小的问题

### 2.14.0 - 2022-06-04

#### Breaking Changes 📣

- 升级 Cesium 到 1.94.2 版本

#### Additions 🎉

- 添加发光圆锥覆盖物

#### Fixes 🔧

- 优化覆盖物添加和移除功能
- 修复历史轨迹清除功能无效问题 [#102](https://github.com/dvgis/dc-sdk/issues/102)
- 修复编辑圆无法使用问题 [#104](https://github.com/dvgis/dc-sdk/issues/104)
- 修复移除 Cesium.when 导致部分分析功能无法使用问题 [#105](https://github.com/dvgis/dc-sdk/issues/105)

### 2.13.0 - 2022-05-08

#### Breaking Changes 📣

- 升级 Cesium 到 1.93.0 版本

#### Additions 🎉

- 添加场景卷帘效果
- 添加 s3m 高度偏移设置 [#98](https://github.com/dvgis/dc-sdk/issues/98)
- 添加标绘线添加最大锚点数 [#99](https://github.com/dvgis/dc-sdk/issues/99)
- 添加历史轨迹添加模型朝向设置(heading 偏移) [#100](https://github.com/dvgis/dc-sdk/issues/100)

#### Fixes 🔧

- 修复 plot 标绘坐标为空的问题 [#95](https://github.com/dvgis/dc-sdk/issues/95)

### 2.12.0 - 2022-04-10

#### Breaking Changes 📣

- 升级 Cesium 到 1.92.0 版本

#### Additions 🎉

- 添加 3dtiles 卷帘效果
- 添加 LocationBar 的 FPS 和 MS 参数
- 添加自定义 logo 的功能(需通过认证)

#### Fixes 🔧

- 修复 Cesium.when 去除产生的问题
- 完善地图卷帘效果

### 2.11.0 - 2022-03-12

#### Breaking Changes 📣

- 升级 Cesium 到 1.91.0 版本

#### Additions 🎉

- 添加 MSAA (抗锯齿的一种) 的支持
- 添加 GPX 图层
- 添加 S3M 图层(作为单独包)

#### Fixes 🔧

- 解决 node-sass 安装的问题

### 2.10.0 - 2022-02-20

#### Breaking Changes 📣

- 升级 Cesium 到 1.90.0 版本

#### Additions 🎉

- 添加地图过滤色的功能
- 添加框架对于 vite 的支持

#### Fixes 🔧

- 解决 Mapv 模块打包的问题

### 2.9.0 - 2022-01-08

#### Breaking Changes 📣

- 升级 Cesium 到 1.89.0 版本

#### Additions 🎉

- 添加 protocol 参数设置当创建部分地图瓦片
- 添加部分工具类类名简写

#### Fixes 🔧

- 解决右击菜单内容为空依旧显示的问题
- 解决覆盖物样式设置覆盖问题
- 解决部分覆盖物设置标签无效的问题

### 2.8.0 - 2021-12-04

#### Breaking Changes 📣

- 升级 Cesium 到 1.88.0 版本

#### Additions 🎉

- 添加贴地图元图层
- 添加 3Dtiles 的替换和追加片元着色器两种模式
- 添加水面图元洞面参数
- 添加热区图层对贴地的支持

#### Fixes 🔧

- 完善图元图层清除或移除功能
- 完善历史轨迹功能

### 2.7.0 - 2021-11-13

#### Breaking Changes 📣

- 升级 Cesium 到 1.87.0 版本

#### Additions 🎉

- 添加覆盖物云
- 添加获取图层组函数

#### Fixes 🔧

- 完善标绘功能

### 2.6.1 - 2021-10-23

#### Breaking Changes 📣

- 升级 Cesium 到 1.86.1 版本

#### Fixes 🔧

- 完善 DivIcon 的样式位置的设置
- 完善 Popup 的样式位置的设置
- 完善添加地形名称的设置 [#74](https://github.com/dvgis/dc-sdk/pull/74)

### 2.6.0 - 2021-10-10

#### Breaking Changes 📣

- 升级 Cesium 到 1.86.0 版本

#### Fixes 🔧

- 完善地图切换组件样式 [#70](https://github.com/dvgis/dc-sdk/pull/70)
- 完善相机环绕功能 [#72](https://github.com/dvgis/dc-sdk/issues/72)

### 2.5.0 - 2021-09-04

#### Breaking Changes 📣

- 升级 Cesium 到 1.85.0 版本

#### Fixes 🔧

- 修复漫游无法设置参数以及失效相机无法移动的问题 [#65](https://github.com/dvgis/dc-sdk/issues/65)
- 修复热区图层渐变设置失效的问题 [#66](https://github.com/dvgis/dc-sdk/issues/66)
- 完善 DivIcon 的样式设定

### 2.4.2 - 2021-08-28

#### Fixes 🔧

- 隐藏图表图层当在地球背面 [#55](https://github.com/dvgis/dc-sdk/issues/55)
- 隐藏 DivIcon 当在地球背面时 [#56](https://github.com/dvgis/dc-sdk/issues/56)
- 完善模型位置编辑工具 [#57](https://github.com/dvgis/dc-sdk/issues/57)
- 完善地形裁剪分析 [#58](https://github.com/dvgis/dc-sdk/issues/58)

### 2.4.1 - 2021-08-21

#### Additions 🎉

- 添加图层鼠标事件的支持 [#53](https://github.com/dvgis/dc-sdk/issues/54)
- 添加部分鼠标默认事件 [#54](https://github.com/dvgis/dc-sdk/issues/54)
- 添加获取瓦片信息的函数

#### Fixes 🔧

- 完善标绘功能

### 2.4.0 - 2021-08-07

#### Breaking Changes 📣

- 升级 Cesium 到 1.84.0 版本

#### Additions 🎉

- 添加跳动图元覆盖物
- 添加模型集合图元

#### Fixes 🔧

- 完善类型属性
- 完善鼠标事件的管理
- 完善 once 事件

### 2.3.2 - 2021-07-25

#### Additions 🎉

- 添加模型图元获取节点相关函数 [#51](https://github.com/dvgis/dc-sdk/issues/51)

#### Fixes 🔧

- 完善历史轨迹恢复功能 [#50](https://github.com/dvgis/dc-sdk/issues/50)

### 2.3.1 - 2021-07-19

#### Breaking Changes 📣

- 重构标绘功能
- 移除 Position 舍弃函数
- 完善基础架构部分脚本

#### Additions 🎉

- 添加空间测量工具
- 添加标绘工具模块
- 添加函数 midCartesian，计算笛卡尔坐标系的中间点位

#### Fixes 🔧

- 完善 Position 复制功能
- 完善模型编辑工具对于 3dtiles 的位置编辑功能
- 完善函数 area
- 完善扇形的点位计算功能

### 2.3.0 - 2021-07-03

#### Breaking Changes 📣

- 升级 Cesium 到 1.83.0 版本

#### Additions 🎉

- 添加鼠标模式的常量
- 添加地球地形夸张的属性设置

#### Fixes 🔧

- 完善字符串坐标转换功能

### 2.2.5 - 2021-06-26

#### Additions 🎉

- 添加线和面的旋转转换计算

#### Fixes 🔧

- 完善历史轨迹的插值方式
- 完善标绘模块在模型上标绘的功能
- 修复可视域分析变换参数时闪烁的问题[#37](https://github.com/dvgis/dc-sdk/issues/37)
- 修复 DivIcon 无法获取当前坐标默认设置为 (0,0,0) 的问题[#38](https://github.com/dvgis/dc-sdk/issues/38)

### 2.2.4 - 2021-06-12

#### Breaking Changes 📣

- 重构漫游功能，漫游功能分为第一人称漫游和键盘漫游[#34](https://github.com/dvgis/dc-sdk/issues/34)
- 原有的漫游功能变为历史轨迹，完善其暂停和播放[#35](https://github.com/dvgis/dc-sdk/issues/35)

#### Fixes 🔧

- 完善 heading 函数
- 完善扩散墙功能
- 修复 RadarScan 缺少 Cesium 的问题[#33](https://github.com/dvgis/dc-sdk/issues/33)

### 2.2.3 - 2021-06-05

#### Breaking Changes 📣

- 修改`CESIUM_BASE_URL`设置，可通过全局属性`baseUrl`进行赋值设置，默认为`./libs/dc-sdk/resources/`

#### Additions 🎉

- 添加各类基本图元要素如：点、线、图标、文本
- 添加扩散墙图元

#### Fixes 🔧

- 完善场景销毁功能
- 完善图元的鼠标和右击菜单事件

### 2.2.2 - 2021-05-29

#### Additions 🎉

- 开放部分 Cesium 内部属性
- 添加可视域分析
- 添加等高线分析

#### Fixes 🔧

- 完善相机通用工具
- 完善 Tileset 的 heading-pitch-roll 的设置

### 2.2.1 - 2021-05-22

#### Additions 🎉

- 添加相机视频图层、平面视频图层
- 添加平面视频覆盖物
- 添加模型图元覆盖物

#### Fixes 🔧

- 修改风向图层在 2 维中显示不正确的问题[#28](https://github.com/dvgis/dc-sdk/issues/28)
- 修复视频融合功能辅助视锥无法显示的问题[#29](https://github.com/dvgis/dc-sdk/issues/29)
- 完善视频图元功能
- 修复场景时间暂停后无法使用动画功能的问题[#31](https://github.com/dvgis/dc-sdk/issues/31)

### 2.2.0 - 2021-05-09

#### Breaking Changes 📣

- 升级 Cesium 到 1.81.0 版本
- 重写 HeatLayer 的实现方式

#### Additions 🎉

- 添加动态图层
- 添加动态模型和动态图标覆盖物
- 添加模型管理功能，用于模型的展开、合并
- 添加日照分析、通视分析功能

### 2.1.4 - 2021-04-24

#### Additions 🎉

- 添加创建 TMS、Grid、Mapbox、MapboxStyle 的地图函数
- 添加剖切分析模块，包括：地球裁剪、地形裁剪
- 添加近地天地盒

#### Fixes 🔧

- 完善标绘功能和解决 issue[#26](https://github.com/dvgis/dc-sdk/issues/26)
- 完善模型位置编辑工具
- 解决 FeatureGridLayer 显示和隐藏问题

### 2.1.3 - 2021-04-17

#### Additions 🎉

- 开放部分 Cesium 内部函数
- 添加 FeatureGridLayer

#### Fixes 🔧

- 修复部分军标无法使用的问题[#24](https://github.com/dvgis/dc-sdk/issues/24)
- 重写 logo 的实现方式

### 2.1.2 - 2021-04-10

#### Additions 🎉

- 添加 DivIcon 鼠标移入和移出功能
- 添加地图当前分辨率和视野范围属性

#### Fixes 🔧

- 修复绕点环绕和绕地环绕会多次点击会加速的问题[#22](https://github.com/dvgis/dc-sdk/issues/22)
- 修复覆盖物为倾斜摄影时，鼠标事件无法使用的问题[#23](https://github.com/dvgis/dc-sdk/issues/23)

### 2.1.1 - 2021-04-06

#### Fixes 🔧

- 修复部分模块版本号不统一的问题

### 2.1.0 - 2021-04-03

#### Breaking Changes 📣

- 升级 Cesium 到 1.80.0 版本

#### Additions 🎉

- 添加 GeoTools 工具类，主要利用 Turf 进行覆盖物的相关计算

#### Fixes 🔧

- 修改 HtmlLayer 设置 show 的错误问题
- 完善 accessToken 的认证规则

### 2.0.0 - 2021-03-27

#### Breaking Changes 📣

- 重构整个框架代码，将代码模块化处理
- 整合之前分散的模块
- 重构了各个模块包中对 DC 的依赖
- 重新开发了用户手册
- 支持自定安装和整体安装的方式引入 DC

#### Additions 🎉

- 添加 token 认证功能。认证通过可以使用一些分析、点位编辑功能
- 添加 turf 模块的支持，可以通过 `const {turf} = DC.Namespace` 获取 turf

#### Fixes 🔧

- 修改 location bar 时间延迟问题
- 修改雷达扫描材质设置速度无效的问题
