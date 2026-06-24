/**
 * @Author : Caven Chen
 */

import { Cesium } from '../../../libs'
import Edit from './Edit'
import { PlotEventType } from '../../event'
import { midCartesian } from '../../math'
import { Transform } from '../../transform'

class EditPolygon extends Edit {
  constructor(overlay) {
    super(overlay)
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
   * Creates a distance label entity bound to the edge whose mid anchor is at
   * the given odd index. The edge connects the vertices at oddIndex-1 and
   * (oddIndex+1) % len (the closing edge is handled by the wrap-around).
   * @param oddIndex
   * @returns {Cesium.Entity}
   * @private
   */
  _createDistanceLabel(oddIndex) {
    return new Cesium.Entity({
      position: new Cesium.CallbackProperty(() => {
        if (this._positions.length > oddIndex) {
          return this._positions[oddIndex]
        }
        return undefined
      }, false),
      label: {
        text: new Cesium.CallbackProperty(() => {
          let len = this._positions.length
          if (len > oddIndex) {
            let start = this._positions[oddIndex - 1]
            let end = this._positions[(oddIndex + 1) % len]
            return this._formatDistance(
              Cesium.Cartesian3.distance(start, end)
            )
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
   * Rebuilds label entities so their count matches the current edge count
   * (one label per mid anchor, i.e. per odd index).
   * @private
   */
  _refreshLabels() {
    this._labelDelegates.forEach((label) =>
      this._layer.entities.remove(label)
    )
    this._labelDelegates = []
    let count = Math.floor(this._positions.length / 2)
    for (let j = 0; j < count; j++) {
      let label = this._createDistanceLabel(2 * j + 1)
      this._labelDelegates.push(label)
      this._layer.entities.add(label)
    }
  }

  /**
   *
   * @private
   */
  _mountedHook() {
    this._delegate.polygon.hierarchy = new Cesium.CallbackProperty((time) => {
      if (this._positions.length > 2) {
        return new Cesium.PolygonHierarchy(
          this._positions.map((item) => item.clone())
        )
      } else {
        return null
      }
    }, false)
    this._layer.entities.add(this._delegate)
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
    this._overlay.positions = Transform.transformCartesianArrayToWGS84Array(
      this._positions.filter((item, index) => index % 2 === 0)
    )
    this._overlay.show = true
    this._options.onEditStop && this._options.onEditStop(this._overlay)
  }

  /**
   *
   * @private
   */
  _mountAnchor() {
    this._positions = []
    let positions = this._overlay.delegate.polygon.hierarchy.getValue(
      Cesium.JulianDate.now()
    ).positions
    positions.push(positions[0])
    for (let i = 0; i < positions.length - 1; i++) {
      let mid = midCartesian(positions[i], positions[i + 1])
      this._positions.push(positions[i])
      this._positions.push(mid)
    }
    this._positions.forEach((item, index) => {
      this.editTool.fire(PlotEventType.CREATE_ANCHOR, {
        position: item,
        index: index,
        isMid: index % 2 !== 0,
      })
    })
    if (this._options.showDistance) {
      this._refreshLabels()
    }
  }

  /**
   *
   * @param pickedAnchor
   * @param position
   * @returns {boolean}
   * @private
   */
  _onEditAnchorStop({ pickedAnchor, position }) {
    let properties = pickedAnchor.properties.getValue(Cesium.JulianDate.now())
    let currentIndex = properties.index
    if (properties.isMid) {
      let preMidPosition
      let nextMidPosition
      let len = this._positions.length
      if (currentIndex === len - 1) {
        preMidPosition = midCartesian(
          this._positions[currentIndex],
          this._positions[currentIndex - 1]
        )
        nextMidPosition = midCartesian(
          this._positions[currentIndex],
          this._positions[0]
        )
      } else {
        preMidPosition = midCartesian(
          this._positions[currentIndex],
          this._positions[currentIndex - 1]
        )
        nextMidPosition = midCartesian(
          this._positions[currentIndex],
          this._positions[currentIndex + 1]
        )
      }
      this._positions.splice(
        currentIndex,
        1,
        preMidPosition,
        position,
        nextMidPosition
      )
      this.editTool.fire(PlotEventType.CLEAR_ANCHOR)
      this._positions.forEach((item, index) => {
        this.editTool.fire(PlotEventType.CREATE_ANCHOR, {
          position: item,
          index: index,
          isMid: index % 2 !== 0,
        })
      })
      if (this._options.showDistance) {
        this._refreshLabels()
      }
    }
  }

  /**
   *
   * @param pickedAnchor
   * @param position
   * @private
   */
  _onAnchorMoving({ pickedAnchor, position }) {
    let properties = pickedAnchor.properties.getValue(Cesium.JulianDate.now())
    let currentIndex = properties.index
    this._positions[currentIndex] = position
    let len = this._positions.length
    if (!properties.isMid) {
      let preAnchorIndex = -1
      let preMidAnchorIndex = -1
      let nextAnchorIndex = -1
      let nextMidAnchorIndex = -1
      if (currentIndex === 0) {
        preAnchorIndex = len - 2
        preMidAnchorIndex = len - 1
        nextAnchorIndex = currentIndex + 2
        nextMidAnchorIndex = currentIndex + 1
      } else if (currentIndex === len - 2) {
        preAnchorIndex = currentIndex - 2
        preMidAnchorIndex = currentIndex - 1
        nextAnchorIndex = 0
        nextMidAnchorIndex = len - 1
      } else {
        preAnchorIndex = currentIndex - 2
        preMidAnchorIndex = currentIndex - 1
        nextAnchorIndex = currentIndex + 2
        nextMidAnchorIndex = currentIndex + 1
      }
      let preMidPosition = midCartesian(
        this._positions[preAnchorIndex],
        this._positions[currentIndex]
      )
      let nextMidPosition = midCartesian(
        this._positions[nextAnchorIndex],
        this._positions[currentIndex]
      )
      this._positions[preMidAnchorIndex] = preMidPosition
      this._positions[nextMidAnchorIndex] = nextMidPosition
      this.editTool.fire(PlotEventType.UPDATE_ANCHOR, {
        index: preMidAnchorIndex,
        position: preMidPosition,
      })
      this.editTool.fire(PlotEventType.UPDATE_ANCHOR, {
        index: nextMidAnchorIndex,
        position: nextMidPosition,
      })
    }
  }
}

export default EditPolygon
