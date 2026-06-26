/**
 * @Author : zhangxi119
 * @Last Modified By : zhangxi119
 * @Last Modified Time : 2026-06-26 15:20:00
 */
import { Cesium } from '../../../libs'
import Overlay from '../Overlay'
import State from '../../state/State'
import Parse from '../../parse/Parse'
import { Transform } from '../../transform'
import { Util } from '../../utils'
import { MouseEventType } from '../../event'

class TrajectoryLine extends Overlay {
  constructor(positions, options = {}) {
    super()
    this._positions = Parse.parsePositions(positions)
    this._options = options
    this._pointEntities = []
    this._glowImageCache = {}
    this._tooltipContent = options.tooltipContent || null
    this._tooltipTrigger = options.tooltipTrigger || 'both'
    this._showPoints = options.showPoints !== false
    this._lineStyle = {
      color: Cesium.Color.fromCssColorString('#00FFFF'),
      width: 4,
      glowPower: 0.25,
      clampToGround: false,
      dash: false,
      dashLength: 16,
      dashPattern: 255,
      ...(options.lineStyle || {}),
    }
    this._pointStyle = {
      pointSize: 24,
      pointColor: Cesium.Color.fromCssColorString('#FFFF00'),
      ...(options.pointStyle || {}),
    }

    this._delegate = new Cesium.Entity({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          return Transform.transformWGS84ArrayToCartesianArray(this._positions)
        }, false),
        width: this._lineStyle.width,
        material: this._createLineMaterial(),
        clampToGround: this._lineStyle.clampToGround,
      },
    })

    this._state = State.INITIALIZED
  }

  get type() {
    return Overlay.getOverlayType('trajectory_line')
  }

  set positions(positions) {
    this._positions = Parse.parsePositions(positions)
    this._recreatePoints()
  }

  get positions() {
    return this._positions
  }

  /**
   * Creates line material based on dash config
   * @returns {MaterialProperty}
   * @private
   */
  _createLineMaterial() {
    if (this._lineStyle.material) {
      return this._lineStyle.material
    }
    if (this._lineStyle.dash) {
      return new Cesium.PolylineDashMaterialProperty({
        color: this._lineStyle.color,
        gapColor: Cesium.Color.TRANSPARENT,
        dashLength: this._lineStyle.dashLength,
        dashPattern: this._lineStyle.dashPattern,
      })
    }
    return new Cesium.PolylineGlowMaterialProperty({
      color: this._lineStyle.color,
      glowPower: this._lineStyle.glowPower,
    })
  }

  /**
   * Generates a radial-gradient glow image as data url, cached by color
   * @param color {Cesium.Color}
   * @returns {string}
   * @private
   */
  _createGlowImage(color) {
    let cssColor = color.toCssColorString()
    if (this._glowImageCache[cssColor]) {
      return this._glowImageCache[cssColor]
    }
    let size = 128
    let canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    let ctx = canvas.getContext('2d')
    let center = size / 2
    let gradient = ctx.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center
    )
    let r = Math.round(color.red * 255)
    let g = Math.round(color.green * 255)
    let b = Math.round(color.blue * 255)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`)
    gradient.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, 0.85)`)
    gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.35)`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    let dataUrl = canvas.toDataURL()
    this._glowImageCache[cssColor] = dataUrl
    return dataUrl
  }

  /**
   * Computes point size for given index (head large, tail small = 1/3 of head)
   * @param index {number}
   * @returns {number}
   * @private
   */
  _getPointSize(index) {
    let maxSize = this._pointStyle.pointSize
    let count = this._positions.length
    if (count <= 1) {
      return maxSize
    }
    return maxSize * (1 - (2 / 3) * (index / (count - 1)))
  }

  /**
   * Creates glow billboard entities for each position
   * @private
   */
  _createPoints() {
    if (!this._showPoints || !this._layer) {
      return
    }
    this._pointEntities = []
    let glowImage = this._createGlowImage(this._pointStyle.pointColor)
    this._positions.forEach((pos, index) => {
      let size = this._getPointSize(index)
      let pointEntity = this._layer.delegate.entities.add({
        position: Transform.transformWGS84ToCartesian(pos),
        billboard: {
          image: glowImage,
          width: size,
          height: size,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          trajectoryIndex: index,
          trajectoryPosition: pos,
        },
      })
      pointEntity.overlayId = this._id
      pointEntity.layerId = this._layer?.layerId
      this._pointEntities.push(pointEntity)
    })
  }

  /**
   * Recreates all point entities
   * @private
   */
  _recreatePoints() {
    this._removePoints()
    this._createPoints()
  }

  /**
   * Removes all point entities
   * @private
   */
  _removePoints() {
    if (this._layer?.delegate?.entities) {
      this._pointEntities.forEach((entity) => {
        this._layer.delegate.entities.remove(entity)
      })
    }
    this._pointEntities = []
  }

  /**
   * Extracts trajectory point data from a picked event and enriches the
   * event payload with trajectoryIndex / trajectoryPosition / trajectoryPositions
   * @param e
   * @returns {{index: number, position: *}|null}
   * @private
   */
  _getPointData(e) {
    let entity = e?.target?.id
    if (!entity || !entity.properties) {
      return null
    }
    let val = entity.properties.getValue(Cesium.JulianDate.now())
    let index = val?.trajectoryIndex
    let pos = val?.trajectoryPosition
    if (index === undefined || !pos) {
      return null
    }
    // enrich event payload for user `.on()` listeners
    e.trajectoryIndex = index
    e.trajectoryPosition = pos
    e.trajectoryPositions = this._positions
    return { index, position: pos }
  }

  /**
   * Shows tooltip at the given window position for a point
   * @param e
   * @param data {{index: number, position: *}}
   * @private
   */
  _showTooltip(e, data) {
    if (!this._tooltipContent) {
      return
    }
    let viewer = this._layer?.viewer
    if (viewer && viewer.tooltip) {
      viewer.tooltip.enable = true
      viewer.tooltip.showAt(
        e.windowPosition,
        this._tooltipContent(data.index, data.position, this._positions)
      )
    }
  }

  /**
   * Hides tooltip
   * @private
   */
  _hideTooltip() {
    let viewer = this._layer?.viewer
    if (viewer && viewer.tooltip) {
      let wrapper = viewer.tooltip._wrapper
      if (wrapper) {
        wrapper.style.visibility = 'hidden'
      }
    }
  }

  /**
   * Mouse over handler (enriches payload + hover tooltip)
   * @param e
   * @private
   */
  _onMouseOver(e) {
    let data = this._getPointData(e)
    if (!data) {
      return
    }
    if (this._tooltipTrigger === 'hover' || this._tooltipTrigger === 'both') {
      this._showTooltip(e, data)
    }
  }

  /**
   * Mouse out handler
   * @private
   */
  _onMouseOut() {
    if (this._tooltipTrigger === 'hover' || this._tooltipTrigger === 'both') {
      this._hideTooltip()
    }
  }

  /**
   * Click handler (enriches payload + click tooltip)
   * @param e
   * @private
   */
  _onClick(e) {
    let data = this._getPointData(e)
    if (!data) {
      return
    }
    if (this._tooltipTrigger === 'click' || this._tooltipTrigger === 'both') {
      this._showTooltip(e, data)
    }
  }

  /**
   * Viewer-level click handler to hide tooltip when clicking off a point
   * @param e
   * @private
   */
  _onViewerClick(e) {
    let entity = e?.target?.id
    if (entity && this._pointEntities.indexOf(entity) !== -1) {
      return
    }
    this._hideTooltip()
  }

  _mountedHook() {
    this._createPoints()
    this.on(MouseEventType.MOUSE_OVER, this._onMouseOver, this)
    this.on(MouseEventType.MOUSE_OUT, this._onMouseOut, this)
    this.on(MouseEventType.CLICK, this._onClick, this)
    if (this._tooltipTrigger === 'click' || this._tooltipTrigger === 'both') {
      let viewer = this._layer?.viewer
      if (viewer) {
        viewer.on(MouseEventType.CLICK, this._onViewerClick, this)
      }
    }
  }

  _removedHook() {
    this._removePoints()
    this.off(MouseEventType.MOUSE_OVER, this._onMouseOver, this)
    this.off(MouseEventType.MOUSE_OUT, this._onMouseOut, this)
    this.off(MouseEventType.CLICK, this._onClick, this)
    let viewer = this._layer?.viewer
    if (viewer) {
      viewer.off(MouseEventType.CLICK, this._onViewerClick, this)
    }
  }

  /**
   * Sets line style
   * @param style
   * @returns {TrajectoryLine}
   */
  setStyle(style) {
    if (!style || Object.keys(style).length === 0) {
      return this
    }
    delete style['positions']
    Util.merge(this._lineStyle, style)
    if (this._delegate.polyline) {
      if (
        style.material ||
        style.color ||
        style.glowPower ||
        style.dash !== undefined ||
        style.dashLength !== undefined ||
        style.dashPattern !== undefined
      ) {
        this._delegate.polyline.material = this._createLineMaterial()
      }
      if (style.width !== undefined) {
        this._delegate.polyline.width = style.width
      }
      if (style.clampToGround !== undefined) {
        this._delegate.polyline.clampToGround = style.clampToGround
      }
    }
    return this
  }

  /**
   * Sets point style
   * @param style
   * @returns {TrajectoryLine}
   */
  setPointStyle(style) {
    if (!style || Object.keys(style).length === 0) {
      return this
    }
    Util.merge(this._pointStyle, style)
    this._recreatePoints()
    return this
  }

  /**
   * Sets tooltip content callback
   * @param callback (index, position, allPositions) => string
   * @returns {TrajectoryLine}
   */
  setTooltipContent(callback) {
    this._tooltipContent = callback
    return this
  }

  /**
   * Parse from entity
   * @param entity
   * @returns {TrajectoryLine}
   */
  static fromEntity(entity) {
    let trajectory = undefined
    let now = Cesium.JulianDate.now()
    if (entity.polyline) {
      let positions = Transform.transformCartesianArrayToWGS84Array(
        entity.polyline.positions.getValue(now)
      )
      trajectory = new TrajectoryLine(positions)
      trajectory.attr = {
        ...entity?.properties?.getValue(now),
      }
    }
    return trajectory
  }
}

Overlay.registerType('trajectory_line')

export default TrajectoryLine
