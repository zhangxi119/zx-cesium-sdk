/**
 * @Author: Caven
 * @Date: 2019-12-30 09:24:37
 * @Last Modified By : zhangxi119
 * @Last Modified Time : 2026-09-19 17:40:00
 */

import { Cesium } from '../../libs'
import { Util } from '../utils'

/**
 * 地球上未贴图区域的默认基色（模块级常量，避免每次 setOptions 都新建 Color）
 */
const DEFAULT_GLOBE_BASE_COLOR = new Cesium.Color(0, 0, 0.5, 1)

/**
 * 判断配置项是否被显式提供（含 null 判定）
 * 用于「只应用传入项」语义：未提供时完全不触碰既有值
 * @param {*} value
 * @returns {boolean}
 */
function isProvided(value) {
  return value !== undefined
}

class ViewerOption {
  constructor(viewer) {
    this._viewer = viewer
    this._viewer.scene.screenSpaceCameraController.maximumZoomDistance = 40489014.0
    this._options = {}
    /**
     * 性能默认值：关闭「太阳泛光」（sunBloom）
     *
     * Cesium 的 `Scene.sunBloom` 默认为 `true`，开启后每帧会执行
     * **2 个全分辨率的模糊 pass**（水平 + 垂直）。在空天/俯视类 GIS 场景中视觉收益很低，
     * 却持续占用填充率。此处作为 DC 的默认值在构造期一次性关闭；
     * 需要该效果时通过 `setOptions({ showSunBloom: true })` 显式开启。
     */
    this._viewer.scene.sunBloom = false
    /**
     * 保持 DC 既有视觉：未贴图区域基色沿用 DC 的深蓝色默认值。
     * 在构造期一次性设置（而非每次 setOptions 重置），并使用模块级常量避免重复分配 Color；
     * 需要自定义时通过 `setOptions({ globe: { baseColor } })` 覆盖。
     */
    if (this._viewer.scene.globe) {
      this._viewer.scene.globe.baseColor = DEFAULT_GLOBE_BASE_COLOR
    }
  }

  /**
   * Sets viewer option
   * 只应用本次显式传入的项，未传入时保持既有值
   * @returns {ViewerOption}
   * @private
   */
  _setViewerOption() {
    if (isProvided(this._options.shadows)) {
      this._viewer.delegate.shadows = this._options.shadows
    }
    if (isProvided(this._options.resolutionScale)) {
      this._viewer.delegate.resolutionScale = this._options.resolutionScale
    }
    return this
  }

  /**
   * sets canvas option
   * @returns {ViewerOption}
   * @private
   */
  _setCanvasOption() {
    isProvided(this._options.tabIndex) &&
      this._viewer.scene.canvas.setAttribute('tabIndex', this._options.tabIndex)
    return this
  }

  /**
   * Sets scene option
   *
   * 重要修正（性能）：
   *  1. `msaaSamples` 仅在显式传入时赋值 —— 旧实现写作 `+options.msaaSamples || 1`，
   *     在未传入时会把 Cesium 默认的 4x MSAA 强制降为 1（关闭），造成明显锯齿；
   *  2. `sunBloom` 默认关闭 —— Cesium 默认 `sunBloom = true`，会每帧执行 2 个全分辨率泛光 pass；
   *  3. 其余各项同样「未传入即不触碰」，避免 setOptions 把用户/调优器已设置的值重置。
   * @returns {ViewerOption}
   * @private
   */
  _setSceneOption() {
    let scene = this._viewer.scene

    if (isProvided(this._options.showAtmosphere)) {
      scene.skyAtmosphere.show = this._options.showAtmosphere
    }

    if (isProvided(this._options.showSun)) {
      scene.sun.show = this._options.showSun
    }

    if (isProvided(this._options.showMoon)) {
      scene.moon.show = this._options.showMoon
    }

    if (isProvided(this._options.enableFxaa)) {
      scene.postProcessStages.fxaa.enabled = this._options.enableFxaa
    }

    /**
     * 太阳泛光（sunBloom）：仅在显式传入时覆盖。
     * DC 的默认值已在构造期设为 `false`（见构造函数），此处不再重复强制。
     */
    if (isProvided(this._options.showSunBloom)) {
      scene.sunBloom = !!this._options.showSunBloom
    }

    /**
     * MSAA：仅显式传入时覆盖，且不允许把有效值降级为「未设置」
     * `mc` 为 Cesium 默认（通常 4）；传 0/1 表示显式关闭多重采样
     */
    if (isProvided(this._options.msaaSamples) && scene.msaaSupported) {
      scene.msaaSamples = +this._options.msaaSamples
    }

    if (isProvided(this._options.verticalExaggeration)) {
      scene.verticalExaggeration = this._options.verticalExaggeration
    }

    if (isProvided(this._options.verticalExaggerationRelativeHeight)) {
      scene.verticalExaggerationRelativeHeight =
        this._options.verticalExaggerationRelativeHeight
    }

    return this
  }

  /**
   *
   * @returns {ViewerOption}
   * @private
   */
  _setSkyBoxOption() {
    if (!this._options.skyBox) {
      return this
    }
    let skyBoxOption = this._options.skyBox
    if (skyBoxOption instanceof Cesium.SkyBox) {
      this._viewer.scene.skyBox = skyBoxOption
    } else {
      let skyBox = this._viewer.scene.skyBox
      skyBox.show = skyBoxOption.show ?? true
      if (skyBoxOption.offsetAngle) {
        skyBox.offsetAngle = skyBoxOption.offsetAngle
      }
      if (skyBoxOption?.sources) {
        skyBox.sources = skyBoxOption.sources
      }
    }
    return this
  }

  /**
   * Sets globe option
   *
   * 只应用显式传入的键：未提供的项保持既有值（避免 setOptions 重置用户/调优器的设置）
   * @returns {ViewerOption}
   * @private
   */
  _setGlobeOption() {
    if (!this._options.globe) {
      return this
    }

    let globe = this._viewer.scene.globe
    let globeOption = this._options.globe

    /**
     * 逐项构造补丁对象，只包含显式提供的键
     */
    let patch = {}
    const assignIfProvided = (key, value) => {
      if (isProvided(value)) {
        patch[key] = value
      }
    }

    assignIfProvided('show', globeOption.show)
    assignIfProvided('showGroundAtmosphere', globeOption.showGroundAtmosphere)
    assignIfProvided('enableLighting', globeOption.enableLighting)
    assignIfProvided('depthTestAgainstTerrain', globeOption.depthTestAgainstTerrain)
    assignIfProvided('tileCacheSize', globeOption.tileCacheSize)
    assignIfProvided('preloadSiblings', globeOption.preloadSiblings)
    assignIfProvided('showSkirts', globeOption.showSkirts)
    assignIfProvided('baseColor', globeOption.baseColor)

    if (Object.keys(patch).length > 0) {
      Util.merge(globe, patch)
    }

    /**
     * 半透明（translucency）：同样只应用显式传入的键
     */
    let translucencyOption = globeOption.translucency
    if (translucencyOption) {
      let translucencyPatch = {}
      if (isProvided(translucencyOption.enabled)) {
        translucencyPatch.enabled = translucencyOption.enabled
      }
      if (isProvided(translucencyOption.backFaceAlpha)) {
        translucencyPatch.backFaceAlpha = +translucencyOption.backFaceAlpha
      }
      if (isProvided(translucencyOption.backFaceAlphaByDistance)) {
        translucencyPatch.backFaceAlphaByDistance =
          translucencyOption.backFaceAlphaByDistance
      }
      if (isProvided(translucencyOption.frontFaceAlpha)) {
        translucencyPatch.frontFaceAlpha = +translucencyOption.frontFaceAlpha
      }
      if (isProvided(translucencyOption.frontFaceAlphaByDistance)) {
        translucencyPatch.frontFaceAlphaByDistance =
          translucencyOption.frontFaceAlphaByDistance
      }
      if (Object.keys(translucencyPatch).length > 0) {
        Util.merge(globe.translucency, translucencyPatch)
      }
    }

    if (globeOption.filterColor) {
      let shaderSource =
        this._viewer.scene.globe._surfaceShaderSet.baseFragmentShaderSource
      let globeFS = shaderSource.sources.pop()
      shaderSource.sources.push(
        globeFS.replace(
          'out_FragColor =  finalColor;',
          `out_FragColor =  finalColor * vec4${globeOption.filterColor.toString()};`
        )
      )
    }

    return this
  }

  /**
   * 设置相机控制器选项（只应用显式传入的键）
   * @returns {ViewerOption}
   * @private
   */
  _setCameraController() {
    if (!this._options?.cameraController) {
      return this
    }

    let sscc = this._viewer.scene.screenSpaceCameraController
    let cameraController = this._options.cameraController

    let patch = {}
    const keys = [
      'enableInputs',
      'enableRotate',
      'enableTilt',
      'enableTranslate',
      'enableZoom',
      'enableCollisionDetection',
      'minimumZoomDistance',
      'maximumZoomDistance'
    ]
    keys.forEach((key) => {
      if (isProvided(cameraController[key])) {
        patch[key] = cameraController[key]
      }
    })

    if (Object.keys(patch).length > 0) {
      Util.merge(sscc, patch)
    }
    return this
  }

  /**
   * 设置选项
   *
   * 语义说明（相对旧实现的行为修正）：
   *  - 旧实现是「累积合并 + 重放全部 setter」，导致**未传入的项被重置为默认值**
   *    （典型症状：调用一次 setOptions 就把 msaaSamples 重置为 1、大气层重置为 true）；
   *  - 现实现为「累积合并 + 只应用本次传入的键」，未传入的项**完全不触碰**。
   * @param options
   * @returns {ViewerOption}
   */
  setOptions(options) {
    if (!options || Object.keys(options).length === 0) {
      return this
    }
    this._options = {
      ...this._options,
      ...options,
    }
    /**
     * 只重放「本次传入」的 setter，未涉及的配置域直接跳过，
     * 避免把用户已设置的值重置（这是旧实现的性能与行为缺陷）
     */
    if ('shadows' in options || 'resolutionScale' in options) {
      this._setViewerOption()
    }
    if ('tabIndex' in options) {
      this._setCanvasOption()
    }
    this._setSceneOption()
    if ('skyBox' in options) {
      this._setSkyBoxOption()
    }
    this._setGlobeOption()
    this._setCameraController()
    return this
  }
}

export default ViewerOption
