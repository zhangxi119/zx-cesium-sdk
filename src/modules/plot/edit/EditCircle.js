import { Cesium } from '../../../libs'
import Edit from './Edit'
import { PlotEventType } from '../../event'
import { Transform } from '../../transform'

class EditCircle extends Edit {
  constructor(overlay) {
    super(overlay)
    this._center = undefined
    this._radius = 0
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
    this._radius = this._overlay.radius
    this._center = Transform.transformWGS84ToCartesian(this._overlay.center)
    this._positions = [].concat([
      this._center,
      this._computeCirclePoints(this._center, this._radius)[0],
    ])
    this._delegate.ellipse = null
    this._delegate.polygon = {
      ...this._overlay._style,
    }
    this._delegate.polygon.hierarchy = new Cesium.CallbackProperty((time) => {
      if (this._positions.length > 1) {
        this._radius = Cesium.Cartesian3.distance(
          this._positions[0],
          this._positions[1]
        )
        if (this._radius <= 0) {
          return null
        }
        let pnts = this._computeCirclePoints(this._positions[0], this._radius)
        pnts.push(pnts[0])
        return new Cesium.PolygonHierarchy(pnts)
      } else {
        return null
      }
    }, false)
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
   * @param center
   * @param radius
   * @returns {*[]}
   * @private
   */
  _computeCirclePoints(center, radius) {
    let pnts = []
    let cep = Cesium.EllipseGeometryLibrary.computeEllipsePositions(
      {
        center: center,
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        rotation: 0,
        granularity: 0.005,
      },
      false,
      true
    )
    if (cep && cep.outerPositions) {
      pnts = Cesium.Cartesian3.unpackArray(cep.outerPositions)
    }
    return pnts
  }

  /**
   *
   * @private
   */
  _stoppedHook() {
    this._labelDelegate && this._layer.entities.remove(this._labelDelegate)
    this._labelDelegate = undefined
    this._overlay.center = Transform.transformCartesianToWGS84(
      this._positions[0]
    )
    this._overlay.radius = this._radius
    this._overlay.show = true
    this._options.onEditStop && this._options.onEditStop(this._overlay)
  }

  /**
   *
   * @private
   */
  _mountAnchor() {
    this._positions.forEach((item, index) => {
      this.editTool.fire(PlotEventType.CREATE_ANCHOR, {
        position: item,
        index: index,
        isCenter: index % 2 === 0,
      })
    })
  }
}

export default EditCircle
