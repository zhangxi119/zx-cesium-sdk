/**
 * @Author : Caven Chen
 */

import { Cesium } from '../../../libs'
import { PlotEventType } from '../../event'
import { Transform } from '../../transform'
import { Polygon } from '../../overlay'
import Draw from './Draw'

const DEF_STYLE = {
  material: Cesium.Color.YELLOW.withAlpha(0.6),
  fill: true,
}

class DrawPolygon extends Draw {
  constructor(style) {
    super()
    this._style = {
      ...DEF_STYLE,
      ...style,
    }
    this._labelDelegates = []
  }

  /**
   *
   * @param distance
   * @returns {string}
   * @private
   */
  _formatDistance(distance) {
    return distance > 1000
      ? `${(distance / 1000).toFixed(2)} 公里`
      : `${distance.toFixed(2)} 米`
  }

  /**
   * Computes the number of edges (segments) to label.
   * Includes the closing edge (last -> first) when there are at least 3 points.
   * @param len
   * @returns {number}
   * @private
   */
  _segmentCount(len) {
    if (len < 2) {
      return 0
    }
    if (len === 2) {
      return 1
    }
    return len
  }

  /**
   *
   * @private
   */
  _mountedHook() {
    this.drawTool.tooltipMess = '左击选择点位,右击结束'
    this._delegate = new Cesium.Entity({
      polygon: {
        ...this._style,
        hierarchy: new Cesium.CallbackProperty(() => {
          if (this._positions.length > 2) {
            return new Cesium.PolygonHierarchy(
              this._positions.map((item) => item.clone())
            )
          } else {
            return null
          }
        }, false),
      },
    })
    this._layer.entities.add(this._delegate)
  }

  /**
   * Creates a distance label entity bound to the segment at the given index.
   * @param index
   * @returns {Cesium.Entity}
   * @private
   */
  _createDistanceLabel(index) {
    return new Cesium.Entity({
      position: new Cesium.CallbackProperty(() => {
        let len = this._positions.length
        if (this._segmentCount(len) > index) {
          let start = this._positions[index]
          let end = this._positions[(index + 1) % len]
          return Cesium.Cartesian3.midpoint(start, end, new Cesium.Cartesian3())
        }
        return undefined
      }, false),
      label: {
        text: new Cesium.CallbackProperty(() => {
          let len = this._positions.length
          if (this._segmentCount(len) > index) {
            let start = this._positions[index]
            let end = this._positions[(index + 1) % len]
            return this._formatDistance(Cesium.Cartesian3.distance(start, end))
          }
          return ''
        }, false),
        font: '14px sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -15),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
      },
    })
  }

  /**
   * Adds/removes label entities so their count matches the current segment count.
   * @private
   */
  _refreshLabels() {
    let count = this._segmentCount(this._positions.length)
    while (this._labelDelegates.length < count) {
      let label = this._createDistanceLabel(this._labelDelegates.length)
      this._labelDelegates.push(label)
      this._layer.entities.add(label)
    }
    while (this._labelDelegates.length > count) {
      let label = this._labelDelegates.pop()
      this._layer.entities.remove(label)
    }
  }

  /**
   *
   * @private
   */
  _stoppedHook() {
    this._labelDelegates.forEach((label) =>
      this._layer.entities.remove(label)
    )
    this._labelDelegates = []
    let polygon = null
    if (this._positions.length) {
      polygon = new Polygon(
        Transform.transformCartesianArrayToWGS84Array(this._positions)
      ).setStyle(this._style)
    }
    this._options.onDrawStop && this._options.onDrawStop(polygon)
  }

  /**
   *
   * @param position
   * @private
   */
  _onDrawAnchor(position) {
    this._positions.push(position)
    this.drawTool.fire(PlotEventType.CREATE_ANCHOR, { position })
    if (this._options.showDistance) {
      this._refreshLabels()
    }
  }
}

export default DrawPolygon
