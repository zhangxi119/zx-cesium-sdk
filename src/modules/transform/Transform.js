/**
 * @Author : Caven Chen
 */

import { Cesium } from '../../libs'
import Position from '../position/Position'

const WMP = new Cesium.WebMercatorProjection()

class Transform {
  /**
   * Transforms Cartesian To WGS84
   * @param cartesian
   * @returns {Position}
   */
  static transformCartesianToWGS84(cartesian) {
    if (cartesian) {
      let cartographic =
        Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian)
      return new Position(
        Cesium.Math.toDegrees(cartographic?.longitude || 0),
        Cesium.Math.toDegrees(cartographic?.latitude || 0),
        cartographic.height || 0
      )
    }
    return new Position(0, 0)
  }

  /**
   * Transforms Cartographic To WGS84
   * @param cartographic
   * @returns {Position}
   */
  static transformCartographicToWGS84(cartographic) {
    if (cartographic) {
      return new Position(
        Cesium.Math.toDegrees(cartographic?.longitude || 0),
        Cesium.Math.toDegrees(cartographic?.latitude || 0),
        cartographic.height || 0
      )
    }
    return new Position(0, 0)
  }

  /**
   * Transforms WGS84 To Cartesian
   * @param position
   * @returns {Cartesian3}
   */
  static transformWGS84ToCartesian(position) {
    return position
      ? Cesium.Cartesian3.fromDegrees(
          position.lng,
          position.lat,
          position.alt,
          Cesium.Ellipsoid.WGS84
        )
      : Cesium.Cartesian3.ZERO
  }

  /**
   * Transforms WGS84 To Cartographic
   * @param position
   * @returns {Cartographic}
   */
  static transformWGS84ToCartographic(position) {
    return position
      ? Cesium.Cartographic.fromDegrees(
          position.lng,
          position.lat,
          position.alt
        )
      : Cesium.Cartographic.ZERO
  }

  /**
   * Transforms Cartesian Array To WGS84 Array
   * @param cartesianArr
   * @returns {*|*[]}
   */
  static transformCartesianArrayToWGS84Array(cartesianArr) {
    return cartesianArr
      ? cartesianArr.map((item) => this.transformCartesianToWGS84(item))
      : []
  }

  /**
   * Transforms WGS84 Array To Cartesian Array
   * @param WGS84Arr
   * @returns {*|*[]}
   */
  static transformWGS84ArrayToCartesianArray(WGS84Arr) {
    return WGS84Arr
      ? WGS84Arr.map((item) => this.transformWGS84ToCartesian(item))
      : []
  }

  /**
   * Transforms WGS84 To Mercator
   * @param position
   * @returns {Position}
   */
  static transformWGS84ToMercator(position) {
    let mp = WMP.project(
      Cesium.Cartographic.fromDegrees(position.lng, position.lat, position.alt)
    )
    return new Position(mp.x, mp.y, mp.z)
  }

  /**
   * Transforms Mercator To WGS84
   * @param position
   * @returns {Position}
   */
  static transformMercatorToWGS84(position) {
    let mp = WMP.unproject(
      new Cesium.Cartesian3(position.lng, position.lat, position.alt)
    )
    return new Position(
      Cesium.Math.toDegrees(mp.longitude),
      Cesium.Math.toDegrees(mp.latitude),
      mp.height
    )
  }

  /**
   * Transforms Window To WGS84
   * @param position
   * @param viewer
   * @returns {Position}
   */
  static transformWindowToWGS84(position, viewer) {
    let scene = viewer.scene
    let cartesian
    if (scene.mode === Cesium.SceneMode.SCENE3D) {
      let ray = scene.camera.getPickRay(position)
      cartesian = scene.globe.pick(ray, scene)
    } else {
      cartesian = scene.camera.pickEllipsoid(position, Cesium.Ellipsoid.WGS84)
    }
    return this.transformCartesianToWGS84(cartesian)
  }

  /**
   * Transforms WGS84 To Window
   * @param position
   * @param viewer
   * @returns {Cartesian2}
   */
  static transformWGS84ToWindow(position, viewer) {
    let scene = viewer.scene
    return Cesium.SceneTransforms.worldToWindowCoordinates(
      scene,
      this.transformWGS84ToCartesian(position)
    )
  }

  /**
   * Generates WGS84 positions on a circle centered at the given position
   * @param {Position} center
   * @param {number} radius - in meters
   * @param {number} segments - default 360
   * @param {number} altitude - force altitude for all points, default center.alt
   * @returns {Position[]}
   */
  static generateCirclePositions(center, radius, segments = 360, altitude = null) {
    let positions = []
    let centerCartesian = this.transformWGS84ToCartesian(center)
    let matrix = Cesium.Transforms.eastNorthUpToFixedFrame(centerCartesian)
    for (let i = 0; i <= segments; i++) {
      let angle = (i * 2 * Math.PI) / segments
      let x = radius * Math.cos(angle)
      let y = radius * Math.sin(angle)
      let offset = new Cesium.Cartesian3(x, y, 0)
      let worldPos = Cesium.Matrix4.multiplyByPoint(
        matrix,
        offset,
        new Cesium.Cartesian3()
      )
      let pos = this.transformCartesianToWGS84(worldPos)
      pos.alt = altitude !== null ? altitude : (center.alt || 0)
      positions.push(pos)
    }
    return positions
  }
}

export default Transform
