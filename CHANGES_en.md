# Change Log

### 1.0.10 - 2026-09-21

#### Fix 🐛 (“flashes once on every update” for live trajectories/links)

> Context: the G2 static-geometry work in 1.0.8 turned polyline `positions` into constant arrays
> (geometry built once per change), but **frequently rewriting a constant property** hits the
> “primitive removed → asynchronously rebuilt” gap of Cesium’s static batching: every assignment
> raises the geometry-changed event → `PolylineVisualizer` removes and re-inserts the updater in
> its static batches → when the line is the **only entity** of its material batch item
> (`StaticGeometryPerMaterialBatch`), the item is destroyed — the currently displayed Primitive is
> **removed outright**, while the replacement is created with `show: false, asynchronous: true` and
> only becomes visible after the Worker finishes building its geometry. The line therefore
> disappears for a moment on every update. With multiple entities sharing one material item the
> primitive is kept (the old one stays until the new one is ready), but the whole batched primitive
> is still rebuilt on every data change.

- **New `dynamicPositions` option (opt-in, off by default, existing behaviour unchanged)**:
  ```js
  new DC.TrajectoryLine(positions, { dynamicPositions: true }) // live trajectory
  new DC.Polyline(positions, { dynamicPositions: true }) // live link
  ```
  `positions` is mounted as a `CallbackProperty` (`isConstant === false`), so Cesium takes the
  `DynamicGeometryUpdater → PolylineCollection` path and **updates the vertex buffer in place**:
  data changes only refresh the callback result, with no primitive destroy/rebuild window
  (no flicker). The cost is one O(vertex count) vertex-buffer write per frame for that line.
  Dynamic mode defaults to `arcType = ArcType.NONE` (skips per-frame geodesic densification;
  override via `lineStyle.arcType` for `TrajectoryLine` or the `arcType` constructor argument for
  `Polyline`). Note: with `clampToGround: true` the dynamic path recreates the
  `GroundPolylinePrimitive` every frame — clamped lines should stay in static mode.
- **Recommended for**: live drone trajectories (appending points every second), live operator/link
  lines (reassigned many times per second), etc. Static or low-frequency lines can keep the default.

#### Clarification 📝

- The statement in the 1.0.8 changelog and some source comments — “dynamic geometry =
  `primitives.removeAndDestroy(primitive)` + `add(new Primitive(...))` every frame (destroying and
  rebuilding GPU vertex buffers)” — **applies to other geometry types (ellipse, polygon, ...)**;
  for **polylines**, the dynamic path in current Cesium is a persistent `PolylineCollection` with
  the vertex buffer **rewritten in place** (`DynamicGeometryUpdater.update` only runs
  `line.positions = positions.slice()`). The related source comments (`Polyline` / `TrajectoryLine`
  / `Track`) have been corrected.

#### Verification ✅

- `npm run verify:perf`: **159 + 67 = 226 assertions / 0 failures** (12 new dynamic-mode
  assertions: property is a `CallbackProperty`, default `arcType = NONE`, property instance
  unchanged after updates with the callback returning the latest vertex count, `dynamicPositions`
  getter state).
- Examples: `trajectory_line.html` gained a “start/stop live-append comparison” button (static
  cyan flickers vs dynamic orange stays smooth); `polyline_base.html` gained a 10 Hz live-link
  sample.

### 1.0.8 - 2026-09-19

#### Line antialiasing 🪄 (fixes "severe polyline jaggedness")

> Context: Cesium's polyline shaders contain **no analytic antialiasing** —
> `PolylineFS.glsl` outputs the material colour directly and `PolylineVS.glsl` only performs a
> `width + 0.5` half-pixel expansion. Polyline edges can therefore only be smoothed by
> MSAA / FXAA / supersampling. DC previously broke that chain in two places and had no
> antialiasing at all in its dash material. All of it is fixed here.

- **`orderIndependentTranslucency` now defaults to `false`** (in `Viewer`'s `DEF_OPTS`).
  This is the **single most important item**: Cesium defaults it to `true`, and while it is on
  every **translucent** primitive (dashed lines, glow lines, colours with alpha < 1) is rendered
  into OIT's own set of **single-sampled** framebuffers (none of the four `FramebufferManager`
  instances in `OIT.js` receives a sample count, and the colour textures are created without one).
  As a result **`scene.msaaSamples` has no effect on them at all**.
  With OIT off, translucent primitives share the multisampled `globeDepth` framebuffer
  (`GlobeDepth.update` forwards `numSamples` to its output FBO, and `Scene.resolveFramebuffers()`
  samples from that FBO when `!useOIT`), so MSAA applies throughout — and OIT's extra FBOs and
  composite passes are skipped as a bonus. The trade-off is that translucent blending degrades
  from order-independent to per-primitive depth sorting, which is invisible for GIS scenes
  dominated by lines, polygons, circles and labels. Pass
  `orderIndependentTranslucency: true` to restore Cesium's behaviour.

- **Canvas `image-rendering` now defaults to `auto`**.
  `CesiumWidget` unconditionally writes `FeatureDetection.imageRenderingValue()`, which is
  **`pixelated`** (nearest-neighbour) in Chrome and Firefox. When the drawing buffer is larger
  than the CSS size (`resolutionScale > 1` or `useBrowserRecommendedResolution = false`),
  the browser downsamples with nearest-neighbour and **cancels the benefit of supersampling**.
  `Viewer` now overrides it to `auto`; pass `imageRendering: 'pixelated'` to restore.

- **New antialiased dash material `PolylineDashAA`**, and the
  `PolylineDashMaterialProperty` export now **points at it**.
  Cesium's `PolylineDash` material hard-quantises a 16-bit mask with `fract` + `floor`, so its
  dash ends are hard-edged. Crucially that aliasing lives **inside** the polyline quad, where
  **MSAA cannot help at all** (MSAA only resolves triangle edges) — it must be smoothed
  analytically in the shader. For reference, of Cesium's three polyline materials
  `PolylineGlow` uses a continuous falloff (naturally smooth) and `PolylineOutline` calls
  `czm_antialias` (already antialiased) — **only `PolylineDash` was left out**.
  The new implementation derives the mask scale in screen space with `fwidth` and applies a
  **3-tap box filter** at half-pixel spacing to obtain the solid coverage, then blends by it.
  It also fixes RGB dilution of the solid colour by a transparent gap under
  **non-premultiplied alpha** (which otherwise darkens the antialiased transition band).

  - New export: `PolylineDashAAMaterialProperty`
  - **`PolylineDashMaterialProperty` now resolves to this implementation** (it extends Cesium's
    class, so constructor options, values and `instanceof` are all equivalent) —
    **existing call sites get smooth dashes with no code change**
  - DC's own dash usages (`TrajectoryLine` and 6 `measure` types) were switched over

- **Fixed the derivative guard in `PolylineDashArrowMaterial` that made it ineffective on WebGL2.**
  The old `#ifdef GL_OES_standard_derivatives` is not defined under WebGL2 (GLSL ES 3.00), so it
  fell into the `base = 0.975` fallback and lost the width-adaptive arrow head.
  It now matches Cesium's `#if (__VERSION__ == 300 || defined(GL_OES_standard_derivatives))`.

#### Performance ⚡ (deep optimization, see `ms-fe-cacs/docs/DC_LIB_PERF_PLAN.md` in the app repo)

**Rendering defaults**

- **`sunBloom` disabled by default**: Cesium defaults `scene.sunBloom = true`, which runs
  2 full-resolution bloom passes every frame. It is now turned off in the `ViewerOption`
  constructor; enable it via `setOptions({ showSunBloom: true })` when needed.
- **`msaaSamples` is no longer force-downgraded**: the old `+options.msaaSamples || 1`
  silently reduced Cesium's default **4x MSAA to 1 (off)** when the option was omitted.
  It is now applied only when explicitly provided.
- **Fixed duplicated `postRender` listener in `Popup`**: `_installHook()` sets
  `this.enable = true` (which already calls `_bindEvent()`) and then called
  `_bindEvent()` again, so the positioning math and DOM writes ran twice per frame.
- **`HawkeyeMap` no longer mutates camera sensitivity unconditionally**: it used to set
  `camera.percentageChanged = 0.01` (Cesium default `0.5`, i.e. 50x more sensitive)
  inside `_installHook()`, which runs for **every** viewer even if the widget is never used.
  It is now applied on enable and restored on disable.

#### Breaking Changes 📣 (behaviour fixes)

- **`ViewerOption.setOptions()` semantics changed**: from "merge and **replay every setter**"
  to "merge and **apply only the keys provided in this call**". The old behaviour reset
  unprovided options to defaults (e.g. a single `setOptions` call reset `msaaSamples` to 1,
  atmosphere/sun/moon to `true` and `resolutionScale` to 1).
- **`Util.merge()` now copies own properties only** (the old `for...in` also copied inherited ones).
- **`MouseEvent` no longer computes `position` / `wgs84Position` by default** (see below).

#### Performance ⚡ (geometry and hot paths)

- **`Polyline.positions` is now a constant array** (was a non-constant `CallbackProperty`).
  Cesium treats non-constant properties as **dynamic geometry** and runs
  `primitives.removeAndDestroy(primitive)` + `primitives.add(new Primitive(...))`
  **every frame** — destroying and rebuilding GPU vertex buffers continuously.
  This was the dominant bottleneck for steady-state 3D frame rate.
- **`Circle.rotateAmount`, `CustomBillboard.setBottomCircle`, `CustomLabel.setBottomCircle`**:
  no callback is installed when `rotateAmount` is 0 (the default), keeping geometry static.
  When rotation is requested it is now **time-based** instead of per-frame accumulation
  (the old version rotated faster or slower depending on frame rate).
- **`TrajectoryLine`**: line `positions` and every point's `position`/`width`/`height`
  are constants now (a 600-point trajectory previously created 1800 per-frame callbacks).
- **`Model.rotateAmount`**: no longer mutates `_position.heading` as a side effect;
  the callback is removed when rotation is disabled.
- **`Track`**: path `positions` is now constant. The old version rebuilt geometry every
  frame **even after playback had finished**.
- **`MouseEvent`**:
  - No longer calls `scene.pickPosition()` on every mouse move (a GPU depth read-back that
    **stalls the render pipeline**). New `enableMouseMovePickPosition` option (default `false`);
    use `wgs84SurfacePosition` instead (pure CPU ellipsoid pick).
  - `_adjustPosition` no longer calls `getBoundingClientRect()` on every invocation
    (forced synchronous layout); results are cached per canvas size, and `_getMouseInfo`
    no longer computes it twice.
  - `_raiseEvent` short-circuits when nothing is picked and the viewer has no listeners,
    skipping target-info construction (`getLayers()` allocation + linear search).
  - `_registerEvent` only registers actions for event types DC actually dispatches.
- **`Viewer.getLayers()` / `getLayer()` / `hasLayer()`**: now use an incrementally maintained
  flat array and a `Map` index. The old implementation allocated arrays via double `Object.keys`
  on **every mouse event**.
- **`Layer.getOverlayById()`**: O(n) linear scan replaced by an O(1) index
  (invalidated correctly when subclasses replace `_cache` in `clear()`).
- **`Transform`**: batch conversion reuses a scratch `Cartographic` and an optional result array;
  `generateCirclePositions` performs zero intermediate allocations
  (previously 3 temporary objects per point — 2160 for a 720-segment ring).
- **`Parse.parsePosition`**: fast path for `Position` instances; removed `Object()` boxing
  and two prototype-chain `hasOwnProperty` lookups (called once per point by `parsePositions`).
- **`Util.isPromise`**: no longer uses `Promise.resolve(obj) == obj` (allocates a Promise);
  it is now a feature check. This method sits in the `Overlay.show` setter, a visibility hot path.
- **`Util.uuid`**: now a counter plus random suffix, keeping the `D-` prefix format.
- **Type lookups**: `getXxxType()` on `Overlay` / `Layer` / `Widget` no longer uses
  `toLocaleUpperCase()` (locale-aware and significantly slower); a lowercase lookup table
  is built at registration time instead.
- **`ContextMenu`**: its `ScreenSpaceEventHandler` is created on enable and destroyed on disable
  (previously every viewer got an extra handler duplicating mouse event dispatch).

#### Features ✨

- `Viewer` accepts `widgets` / `tools` allow-lists to skip unused widgets:
  ```js
  new DC.Viewer('container', {
    widgets: ['popup', 'tooltip'],
    tools: ['drawTool', 'editTool'],
  })
  ```
  The full set is still installed when the options are omitted.

#### Tests ✅

- Added `npm run verify:perf`: a jsdom-based runtime correctness suite
  (83 assertions covering all of the above).

### 4.2.0 - 2025-02-09

#### Breaking Changes 📣

- Upgrade @cesium/engine to version 13.1.0

#### Fixes 🔧

- remove the config context

### 4.1.1 - 2025-01-05

#### Breaking Changes 📣

- Emergency release to add analytics module

### 4.1.0 - 2025-01-05

#### Breaking Changes 📣

- Upgrade @cesium/engine to version 13.0.0

#### Fixes 🔧

- Fix map configuration not working
- Fix the wave circle animation

### 4.0.0

#### Breaking Changes 📣

- Changes to the underlying packaging for fixing a DC is not extensible issue when using node mode [#199](https://github.com/dvgis/dc-sdk/issues/199)
- Upgrade @cesium/engine to version 12.0.0.
- Remove `__namespace` global variable, suggest using `getLib` to get required third-party framework modules.
- Remove the extension module Viewer class and will use `CesiumWidget` as the scene builder class.

#### Additions 🎉

- Added SkyLine analysis feature
- Improve the anchor style function in Plot.
- Opened up some of Cesium's underlying native classes.

#### Fixes 🔧

- Fix mouse pickup issue

### 3.5.0

#### Breaking Changes 📣

- Upgrade @cesium/engine to version 9.1.0.
- Changed Ellipsoid entity class in overlay to Sphere entity class, Ellipsoid to Cesium.Ellipsoid

#### Additions 🎉

- Added custom TilingScheme for adding tiles by cutout origin and scale
- Added enable control overlay move-in and move-out listening parameters
- Add default Cesium clipping polygon

#### Fixes 🔧

- Fix for adding 3dtiles and baselayer to scene split component

### 3.4.0 - 2024-04-04

#### Fixes 🔧

- Optimize the introduction of errors in Node mode

### 3.3.0 - 2024-03-21

#### Breaking Changes 📣

- Upgraded @cesium/engine to version 8.0.0
- Optimize packaging, remove rollup packaging

#### Fixes 🔧

- Optimize aggregated layer calculation interval
- Solve raster tile deletion and destruction problem
- Solve bottom image deletion problem
- Solve the problem that single-image tiles can not be loaded

### 3.2.0 - 2023-09-25

#### Breaking Changes 📣

- Upgraded @cesium/engine to version 4.0.0
- framework to add development mode

#### Additions 🎉

- Added support for tileset hook events
- Added RasterTileLayer

#### Fixes 🔧

- Optimize camera position calculation

### 3.1.0 - 2023-08-06

#### Breaking Changes 📣

- Upgrading @cesium/engine to version 3.0.2
- Document building framework transformed from VuePress to VitePress

#### Additions 🎉

- Add support for cluster layer mouse events

#### Fixes 🔧

- Optimize component initialization for compatibility with third-party frameworks.
- Optimize coordinate conversion function

### 3.0.1

#### Fixes 🔧

- Optimization of measurement functions
- Optimize Google Maps
- Optimize weather effects
- Optimize Chinese documentation

### 3.0.0

#### Breaking Changes 📣

- Upgrade @cesium/engine to version 3.0.1.
- Changed framework dependency from Cesium to @cesium/engine, @cesium/widget library is no longer used, only `Viewer` related code is synchronized.
- Refactored framework packaging, `iife` and `node` generate separate framework packages.
- Refactor the directory structure of the framework library.
- Upgrade material `glsl` to 3.0.
- Remove the `mapv` layer and `s3m` layer, and remove their dependencies.
- Removed global functions `init`, `mixin`, `use`.
- Remove `Namespace` global attribute, you can get third party libraries through global function `getLib`.
- Modify the way of introducing framework `cdn` and `node`, the framework uses a whole package to load.
- Modify the framework entry function to use `ready().then()` as the framework entry.
- Modify the effect class constructor, need to pass `viewer` as parameter.
- Modify the scene dom structure, remove the useless dom.

#### Additions 🎉

- Add sample code to the framework library
- Add documentation code to the framework library
- Add latitude and longitude layers

#### Fixes 🔧

- Optimize aggregation layer, use third party library `supercluster` for aggregation calculation
- Optimize heat zone layer
- Fix a number of issues caused by upgrading the Cesium framework

### 2.17.0 - 2022-10-29

#### Breaking Changes 📣

- Upgrade Cesium to version 1.98.1
- Remove ModelCollectionPrimitive

#### Fixes 🔧

- Fix locatonbar mouse movement coordinate error
- Fix a coordinate conversion problem in transform
- Fix the tile mask issue

### 2.16.2 - 2022-09-13

#### Additions 🎉

- Open some Cesium native classes

#### Fixes 🔧

- Improve the scene export
- Improve terrain loading [#126](https://github.com/dvgis/dc-sdk/issues/126)

### 2.16.1 - 2022-08-21

#### Additions 🎉

- Add mixNum parameter for viewable fields

#### Fixes 🔧

- Improve Model Instance
- Improve heading math

### 2.16.0 - 2022-08-14

#### Breaking Changes 📣

- Upgrade Cesium to version 1.96.0
- Abandon the init function
- Modify Cesium introduction

#### Fixes 🔧

- Optimize the parabola function to add an end point to the calculation result
- Optimize the use of name space module.
- Fix the problem that the framework cannot be used due to repeated use in CDN mode.
- Fix an issue created by upgrading Cesium

### 2.15.0 - 2022-07-16

#### Breaking Changes 📣

- Upgrade Cesium to version 1.95.0

#### Additions 🎉

- Added flyToBounds and zoomToBounds functions
- Added code hint module
- Add scene rendering error subscription event

#### Fixes 🔧

- Optimize position bar elevation value [#109](https://github.com/dvgis/dc-sdk/issues/109)
- Fix the problem of incorrect recovery time of history track several times
- Fix the problem of wrong display of the end of history track[#107](https://github.com/dvgis/dc-sdk/issues/107)
- Fix the problem that the number of anchor points is wrong and the size cannot be set when editing the marker.

### 2.14.0 - 2022-06-04

#### Breaking Changes 📣

- Upgrade Cesium to version 1.94.2

#### Additions 🎉

- Add light cylinder primitive

#### Fixes 🔧

- Optimize overlay add and remove function
- Fix a bug that the history track clear function is not working [#102](https://github.com/dvgis/dc-sdk/issues/102)
- Fix the problem that editing circle doesn't work [#104](https://github.com/dvgis/dc-sdk/issues/104)
- Fix the problem that some analysis functions can't be used because of removing Cesium.when [#105](https://github.com/dvgis/dc-sdk/issues/105)

### 2.13.0 - 2022-05-08

#### Breaking Changes 📣

- Upgrade Cesium to version 1.93.0

#### Additions 🎉

- Added scene split
- Added s3m height offset setting [#98](https://github.com/dvgis/dc-sdk/issues/98)
- Add marker line add max anchor points [#99](https://github.com/dvgis/dc-sdk/issues/99)
- Add history track add model orientation setting (heading offset) [#100](https://github.com/dvgis/dc-sdk/issues/100)

#### Fixes 🔧

- Fix the problem that plot plot coordinates are empty [#95](https://github.com/dvgis/dc-sdk/issues/95)

### 2.12.0 - 2022-04-10

#### Breaking Changes 📣

- Upgrade Cesium to version 1.92.0

#### Additions 🎉

- Added 3dtiles splite effect
- Added FPS and MS parameters for LocationBar
- Added the ability to customize the logo (requires token)

#### Fixes 🔧

- Fix the problem caused by Cesium.when removal
- Improve the map splite effect

### 2.11.0 - 2022-03-12

#### Breaking Changes 📣

- Upgrade Cesium to version 1.91.0

#### Additions 🎉

- Added support for MSAA (a type of anti-aliasing)
- Added GPX layer
- Added S3M layer (as a separate package)

#### Fixes 🔧

- Fixes node-sass installation issues

### 2.10.0 - 2022-02-20

#### Breaking Changes 📣

- Upgrade Cesium to version 1.90.0

#### Additions 🎉

- Added map filter color feature
- Added framework support for vite

#### Fixes 🔧

- Fix Mapv module packaging issue

### 2.9.0 - 2022-02-08

#### Breaking Changes 📣

- Upgrade Cesium to version 1.90.0

#### Additions 🎉

- Added map filter color feature
- Added framework support for vite

#### Fixes 🔧

- Fix Mapv module packaging issue

### 2.9.0 - 2022-01-08

#### Breaking Changes 📣

- Upgrade Cesium to version 1.89.0

#### Additions 🎉

- Added protocol parameter settings when creating partial map tiles
- Add partial tool class name abbreviations

#### Fixes 🔧

- Solve the problem that right click menu content is still displayed when empty
- Fix overlay style setting overlay issue
- Solve the problem that some overlay setting labels are invalid

### 2.8.0 - 2021-12-04

#### Breaking Changes 📣

- Upgrade Cesium to version 1.88.0

#### Additions 🎉

- Add ground primitive layer
- Add both replacement and append FS modes for 3Dtiles
- Add water primitive holes param
- Add hot layer support for classificationType

#### Fixes 🔧

- Improve the function of clearing or removing the primitive layer
- Improve the history track function

### 2.7.0 - 2021-11-13

#### Breaking Changes 📣

- Upgrade Cesium to version 1.87.0

#### Additions 🎉

- Add overlay clouds
- Add get LayerGroup function

#### Fixes 🔧

- Improve the plot module

### 2.6.1 - 2021-10-23

#### Breaking Changes 📣

- Upgrade Cesium to version 1.86.0

#### Fixes 🔧

- Improve the DivIcon style
- Improve the Popup config
- Improve the terrian name option [#74](https://github.com/dvgis/dc-sdk/pull/74)

### 2.6.0 - 2021-10-10

#### Breaking Changes 📣

- Upgrade Cesium to version 1.86.0

#### Fixes 🔧

- Improve the MapSwitch [#70](https://github.com/dvgis/dc-sdk/issues/70)
- Improve the AroundView [#72](https://github.com/dvgis/dc-sdk/issues/72)

### 2.5.0 - 2021-09-04

#### Breaking Changes 📣

- Upgrade Cesium to version 1.85.0

#### Fixes 🔧

- Fix the problem that roaming cannot set parameters and the failed camera cannot move [#65](https://github.com/dvgis/dc-sdk/issues/65)
- Fix the problem that the gradient setting of heat layer [#66](https://github.com/dvgis/dc-sdk/issues/66)
- Improve the DivIcon style

### 2.4.2 - 2021-08-28

#### Fixes 🔧

- Hide the chart layer at the back [#55](https://github.com/dvgis/dc-sdk/issues/55)
- Hide the div icon at the back [#56](https://github.com/dvgis/dc-sdk/issues/56)
- Improve the position editor [#57](https://github.com/dvgis/dc-sdk/issues/57)
- Improve the terrain clipping [#58](https://github.com/dvgis/dc-sdk/issues/58)

### 2.4.1 - 2021-08-21

#### Additions 🎉

- Add support for layer mouse events [#53](https://github.com/dvgis/dc-sdk/issues/54)
- Add partial mouse default events [#54](https://github.com/dvgis/dc-sdk/issues/54)
- Add function to get tile information

#### Fixes 🔧

- Improve the plot function

### 2.4.0 - 2021-08-07

#### Breaking Changes 📣

- Upgrade Cesium to version 1.84.0

#### Additions 🎉

- Add bounce primitive overlays
- Add model collection primitive

#### Fixes 🔧

- Refine type property
- Improve mouse event
- Improve once event

### 2.3.2 - 2021-07-25

#### Additions 🎉

- Add model primitive to get node-related functions [#51](https://github.com/dvgis/dc-sdk/issues/51)

#### Fixes 🔧

- Improve the history track restore function [#50](https://github.com/dvgis/dc-sdk/issues/50)

### 2.3.1 - 2021-07-19

#### Breaking Changes 📣

- Refactored plotting function
- Remove Position rounding function
- Refine the infrastructure part of the script

#### Additions 🎉

- Add spatial measurement tools
- Add the plotting tool module
- Add function midCartesian to calculate the middle point of Cartesian3

#### Fixes 🔧

- Improve the Position copy function
- Improve the model editing tool for 3dtiles position editing function
- Improve the function area
- Improve the function of calculating the point position of a sector

### 2.3.0 - 2021-07-03

#### Breaking Changes 📣

- Upgrade Cesium to version 1.83.0

#### Additions 🎉

- Add constants for mouse mode
- Add property settings for globe terrain exaggeration

#### Fixes 🔧

- Improve the parsePositions for string coords

### 2.2.5 - 2021-06-26

#### Additions 🎉

- Adds line and face rotation conversion calculations

#### Fixes 🔧

- Improve the interpolation of history track
- Improve the function of plot for above the overlay
- Fix the problem of flickering when analyzing transformation parameters in the viewable field [#37](https://github.com/dvgis/dc-sdk/issues/37)
- Fix the problem that DivIcon cannot get the current coordinates set to (0,0,0) by default [#38](https://github.com/dvgis/dc-sdk/issues/38)

### 2.2.4 - 2021-06-12

#### Breaking Changes 📣

- Refactored the roaming function into first-person roaming and keyboard roaming [#34](https://github.com/dvgis/dc-sdk/issues/34)
- Original roaming function becomes history track, refine its pause and play [#35](https://github.com/dvgis/dc-sdk/issues/35)

#### Fixes 🔧

- Improve heading function
- Improve diffuse wall primitive
- Fixes RadarScan missing Cesium issue [#33](https://github.com/dvgis/dc-sdk/issues/33)

### 2.2.3 - 2021-06-05

#### Breaking Changes 📣

- Modify the `CESIUM_BASE_URL` setting, which can be set via the global property `baseUrl`, which defaults to `. /libs/dc-sdk/resources/`

#### Additions 🎉

- Add various base primitive such as point, line, billboard, text
- Add diffuse wall primitive

#### Fixes 🔧

- Improve the viewer destroy
- Refine mouse and context-menu events for primitive

### 2.2.2 - 2021-05-29

#### Additions 🎉

- Open some Cesium internal properties
- Add viewshed analysis
- Add contour line analysis

#### Fixes 🔧

- Improve camera general tools
- Improve the heading-pitch-roll setting of Tileset

### 2.2.1 - 2021-05-22

#### Additions 🎉

- Add camera video layer and plane video layer
- Add plane video overlay
- Add model primitive overlay

#### Fixes 🔧

- Improve the wind layer add fix the issue[#28](https://github.com/dvgis/dc-sdk/issues/28)
- Repair the problem that the auxiliary view cone of video fusion function cannot be displayed[#29](https://github.com/dvgis/dc-sdk/issues/29)
- Improve the video primitive
- Repair the problem that the animation function cannot be used after the scene time is stoped[#31](https://github.com/dvgis/dc-sdk/issues/31)

### 2.2.0 - 2021-05-09

#### Breaking Changes 📣

- Upgrade Cesium to version 1.81.0
- Rewrite the HeatLayer

#### Additions 🎉

- Add dynamic layer
- Add dynamic model and dynamic billbard
- Add model management functions for model expansion and merging
- Add daylight 、through-view function

### 2.1.4 - 2021-04-24

#### Additions 🎉

- Add map functions for creating TMS, Grid, Mapbox, MapboxStyle
- Add clipping module, including: globe clipping, terrain clipping
- Add GroundSkyBox

#### Fixes 🔧

- Improve the plot module and fix the issue[#26](https://github.com/dvgis/dc-sdk/issues/26)
- Improve the position editor module
- Fix the FeatureGridLayer show and hide issue

### 2.1.3 - 2021-04-17

#### Additions 🎉

- Open section Cesium internal functions
- Add FeatureGridLayer

#### Fixes 🔧

- Fix the plot bugs[#24](https://github.com/dvgis/dc-sdk/issues/24)
- Rewritten logo

### 2.1.2 - 2021-04-10

#### Additions 🎉

- Add DivIcon mouse-over and mouse-out functions
- Add resolution and viewBounds properties

#### Fixes 🔧

- Fix the problem that AroundPoint and AroundView will be accelerated by multiple starts[#22](https://github.com/dvgis/dc-sdk/issues/22)
- Fix the problem that mouse events do not work when the overlay is OSGB[#23](https://github.com/dvgis/dc-sdk/issues/23)

### 2.1.1 - 2021-04-06

#### Fixes 🔧

- Repair the problem that some modules version numbers are not uniform

### 2.1.0 - 2021-04-03

#### Breaking Changes 📣

- Upgrade Cesium to version 1.80.0

#### Additions 🎉

- Add GeoTools class, mainly using Turf for overlay related calculations

#### Fixes 🔧

- Modify the HtmlLayer set show error problem
- Improve the authentication rules of accessToken

### 2.0.0 - 2021-03-27

#### Breaking Changes 📣

- Refactor the entire framework code and modularize the code
- Consolidated previously scattered modules
- Refactored the dependencies on DC in each module package
- Redeveloped the user manual
- Support for custom installation and full installation of DC

#### Additions 🎉

- Added token authentication function. Authentication can use some analysis and point editor functions
- Add support for turf module, you can get turf by `const { turf } = DC.Namespace`.

#### Fixes 🔧

- Fix location bar time delay issue
- Fixed the problem of invalid speed setting for radar scan material
