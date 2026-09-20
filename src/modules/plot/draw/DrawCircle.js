import { Cesium } from '../../../libs'
import { PlotEventType } from '../../event'
import { Transform } from '../../transform'
import { Circle } from '../../overlay'
import Draw from './Draw'

const DEF_STYLE = {
  material: Cesium.Color.YELLOW.withAlpha(0.6),
  fill: true,
}

class DrawCircle extends Draw {
  constructor(style) {
    super()
    this._maxAnchorSize = 2
    this._radius = 0
    this._style = {
      ...DEF_STYLE,
      ...style,
    }
    this._labelDelegate = undefined
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
   *
   * @private
   */
  _mountedHook() {
    this.drawTool.tooltipMess = '单击选择点位'
    this._delegate = new Cesium.Entity({
      polygon: {
        ...this._style,
        hierarchy: new Cesium.CallbackProperty(() => {
          if (this._positions.length > 1) {
            this._radius = Cesium.Cartesian3.distance(
              this._positions[0],
              this._positions[1]
            )
            if (this._radius <= 0) {
              return null
            }
            let cep = Cesium.EllipseGeometryLibrary.computeEllipsePositions(
              {
                center: this._positions[0],
                semiMajorAxis: this._radius,
                semiMinorAxis: this._radius,
                rotation: 0,
                granularity: 0.005,
              },
              false,
              true
            )
            let pnts = Cesium.Cartesian3.unpackArray(cep.outerPositions)
            pnts.push(pnts[0])
            return new Cesium.PolygonHierarchy(pnts)
          } else {
            return null
          }
        }, false),
      },
    })
    this._layer.entities.add(this._delegate)
    if (this._options.showDistance) {
      this._mountDistanceLabel()
    }
  }

  /**
   *
   * @private
   */
  _mountDistanceLabel() {
    this._labelDelegate = new Cesium.Entity({
      position: new Cesium.CallbackProperty(() => {
        if (this._positions.length > 1) {
          return Cesium.Cartesian3.midpoint(
            this._positions[0],
            this._positions[1],
            new Cesium.Cartesian3()
          )
        }
        return undefined
      }, false),
      label: {
        text: new Cesium.CallbackProperty(() => {
          if (this._positions.length > 1 && this._radius > 0) {
            return this._formatDistance(this._radius)
          }
          return ''
        }, false),
        font: '14px sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -15),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
      },
    })
    this._layer.entities.add(this._labelDelegate)
  }

  /**
   *
   * @private
   */
  _stoppedHook() {
    this._labelDelegate && this._layer.entities.remove(this._labelDelegate)
    this._labelDelegate = undefined
    let circle = null
    if (this._positions.length) {
      circle = new Circle(
        Transform.transformCartesianToWGS84(this._positions[0]),
        this._radius
      ).setStyle(this._style)
    }
    this._options.onDrawStop && this._options.onDrawStop(circle)
  }

  /**
   *
   * @param position
   * @private
   */
  _onDrawAnchor(position) {
    let len = this._positions.length
    this._positions.push(position)
    this.drawTool.fire(PlotEventType.CREATE_ANCHOR, {
      position,
      isCenter: len === 1,
    })
    if (len >= this._maxAnchorSize) {
      this._positions.pop()
      this.drawTool.fire(PlotEventType.DRAW_STOP)
    }
  }
}

export default DrawCircle
