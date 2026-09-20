import { Cesium } from '../../libs'
import Position from '../position/Position'

const WMP = new Cesium.WebMercatorProjection()

/**
 * 复用的临时对象（避免在逐点转换中反复分配）
 *
 * `Cartesian3` / `Matrix4` / `Ellipsoid` 的转换方法都支持 `result` 出参，
 * 传入复用对象即可完全免除中间分配 —— 这是「圆周边 720 点」这类
 * 大批量转换的主要优化点。
 */
const scratchCartographic = new Cesium.Cartographic()
const scratchCartesian = new Cesium.Cartesian3()
const scratchOffset = new Cesium.Cartesian3()

class Transform {
  /**
   * Transforms Cartesian To WGS84
   * @param cartesian
   * @returns {Position}
   */
  static transformCartesianToWGS84(cartesian) {
    if (cartesian) {
      let cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(
        cartesian,
        scratchCartographic
      )
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
   * @param position {Position|Object} 含 lng/lat/alt 的坐标
   * @param result {Cartesian3?} 可选复用出参
   * @returns {Cartesian3}
   */
  static transformWGS84ToCartesian(position, result) {
    if (!position) {
      return Cesium.Cartesian3.ZERO
    }
    /**
     * 复用临时 Cartographic：避开 `Cartesian3.fromDegrees` 的两次角度换算调用链，
     * 并在传入 `result` 时完全不产生新分配
     */
    scratchCartographic.longitude = Cesium.Math.toRadians(position.lng)
    scratchCartographic.latitude = Cesium.Math.toRadians(position.lat)
    scratchCartographic.height = position.alt ?? 0
    return Cesium.Ellipsoid.WGS84.cartographicToCartesian(
      scratchCartographic,
      result
    )
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
   *
   * 性能优化：改用「复用临时 Cartographic + 逐点写入出参数组」的批量实现，
   * 取代原先的 `map(item => Cartesian3.fromDegrees(...))`：
   *  - 不再为每个点分配中间对象；
   *  - 可选传入 `result` 复用**元素对象**（外层数组始终新建，
   *    以保证 Cesium 侧「赋值即触发几何重建」的语义）。
   * @param WGS84Arr {Array} 含 lng/lat/alt 的坐标数组
   * @param result {Cartesian3[]?} 可选复用数组（长度需一致）
   * @returns {Cartesian3[]}
   */
  static transformWGS84ArrayToCartesianArray(WGS84Arr, result) {
    if (!WGS84Arr) {
      return []
    }
    const length = WGS84Arr.length
    const reusable = Array.isArray(result) && result.length === length
    /**
     * 外层数组必须新建：Cesium 通过「赋值给 positions」触发 definitionChanged，
     * 复用同一个数组实例会导致几何不更新
     */
    const cartesians = new Array(length)
    const ellipsoid = Cesium.Ellipsoid.WGS84
    for (let i = 0; i < length; i++) {
      const item = WGS84Arr[i]
      if (item) {
        scratchCartographic.longitude = Cesium.Math.toRadians(item.lng)
        scratchCartographic.latitude = Cesium.Math.toRadians(item.lat)
        scratchCartographic.height = item.alt ?? 0
        cartesians[i] = ellipsoid.cartographicToCartesian(
          scratchCartographic,
          reusable ? result[i] : undefined
        )
      } else {
        cartesians[i] = Cesium.Cartesian3.ZERO
      }
    }
    return cartesians
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
   *
   * 性能优化：全程复用临时对象（Cartesian3 / Cartographic / Matrix4 出参），
   * 除每点必须返回的 `Position` 实例外**不再产生任何中间分配**。
   * 优化前每点要分配 3 个临时对象（offset、multiplyByPoint 结果、cartographic），
   * 720 段圆周即 2160 次多余分配 —— 而该函数在每次圆心/半径变更时都会被调用。
   *
   * @param {Position} center
   * @param {number} radius - in meters
   * @param {number} segments - default 360
   * @param {number} altitude - force altitude for all points, default center.alt
   * @returns {Position[]}
   */
  static generateCirclePositions(center, radius, segments = 360, altitude = null) {
    let positions = new Array(segments + 1)
    let centerCartesian = this.transformWGS84ToCartesian(center)
    let matrix = Cesium.Transforms.eastNorthUpToFixedFrame(centerCartesian)
    let ellipsoid = Cesium.Ellipsoid.WGS84
    let finalAlt = altitude !== null ? altitude : center.alt || 0
    let step = (2 * Math.PI) / segments
    for (let i = 0; i <= segments; i++) {
      let angle = i * step
      scratchOffset.x = radius * Math.cos(angle)
      scratchOffset.y = radius * Math.sin(angle)
      scratchOffset.z = 0
      Cesium.Matrix4.multiplyByPoint(matrix, scratchOffset, scratchCartesian)
      /**
       * 复用临时 Cartographic 出参，避免每点新建
       */
      ellipsoid.cartesianToCartographic(scratchCartesian, scratchCartographic)
      positions[i] = new Position(
        Cesium.Math.toDegrees(scratchCartographic.longitude),
        Cesium.Math.toDegrees(scratchCartographic.latitude),
        finalAlt
      )
    }
    return positions
  }
}

export default Transform
