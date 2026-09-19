/**
 * @Author : Caven Chen
 * @Last Modified By : zhangxi119
 * @Last Modified Time : 2026-09-19 18:10:00
 */
import Position from '../position/Position'
import { Cesium } from '../../libs'
import { Transform } from '../transform'

class Parse {
  /**
   * Parses all kinds of coordinates to position
   *
   * 性能优化（相对旧实现）：
   *  1. 把最常见的 `Position` 实例判断提到**最前**（旧实现放在第 4 个分支，
   *     每次都要先做类型/字符串/数组/对象判断）；
   *  2. 去掉 `Object(position)` 装箱 —— 旧实现用 `Object(position).hasOwnProperty('lng')`
   *     会对每个点做两次装箱与两次原型链查找；改用 `in` 运算符等价且更快；
   *  3. `Cartesian3` / `Cartographic` 的 `instanceof` 判断后移，仅在必要时执行。
   *
   * `parsePositions` 对**每个点**调用本方法，圆周边 720 点、轨迹线上千点等场景下
   * 上述差异会被成倍放大。
   * @param position
   * @returns {Position}
   */
  static parsePosition(position) {
    if (!position) {
      return new Position()
    }
    if (position instanceof Position) {
      return position
    }
    if (typeof position === 'string') {
      return Position.fromString(position)
    }
    if (Array.isArray(position)) {
      return Position.fromArray(position)
    }
    if (position instanceof Cesium.Cartesian3) {
      return Transform.transformCartesianToWGS84(position)
    }
    if (position instanceof Cesium.Cartographic) {
      return Transform.transformCartographicToWGS84(position)
    }
    /**
     * 普通对象：含 lng/lat 即视为坐标对象
     * 注意：必须先用 `typeof === 'object'` 守卫，否则对原始值（数字/布尔）使用 `in` 会抛 TypeError
     */
    if (
      typeof position === 'object' &&
      'lng' in position &&
      'lat' in position
    ) {
      return Position.fromObject(position)
    }
    return new Position()
  }

  /**
   * Parses all kinds of coordinates array to position array
   *
   * 快路径：当输入已经是 `Position` 数组时直接返回，不做任何逐点判断
   * @param positions
   * @returns {unknown[]}
   */
  static parsePositions(positions) {
    if (!positions) {
      return []
    }
    if (typeof positions === 'string') {
      if (positions.indexOf('#') >= 0) {
        throw new Error('the positions invalid')
      }
      positions = positions.split(';').filter((item) => !!item)
    }
    if (!Array.isArray(positions)) {
      return []
    }
    /**
     * 快路径：全部已是 Position 实例（DC 内部最常见的情形）
     */
    let allParsed = true
    for (let i = 0; i < positions.length; i++) {
      if (!(positions[i] instanceof Position)) {
        allParsed = false
        break
      }
    }
    if (allParsed) {
      return positions
    }
    let result = new Array(positions.length)
    for (let i = 0; i < positions.length; i++) {
      result[i] = this.parsePosition(positions[i])
    }
    return result
  }

  /**
   * Parses point position to array
   * @param position
   * @returns {*[]}
   */
  static parsePointCoordToArray(position) {
    position = this.parsePosition(position)
    return [position.lng, position.lat]
  }

  /**
   * Parses polyline positions to array
   * @param positions
   * @returns {[]}
   */
  static parsePolylineCoordToArray(positions) {
    let result = []
    positions = this.parsePositions(positions)
    positions.forEach((item) => {
      result.push([item.lng, item.lat])
    })
    return result
  }

  /**
   * Parses polygon positions to array
   * @param positions
   * @param loop
   * @returns {[][]}
   */
  static parsePolygonCoordToArray(positions, loop = false) {
    let result = []
    positions = this.parsePositions(positions)
    positions.forEach((item) => {
      result.push([item.lng, item.lat])
    })
    if (loop && result.length > 0) {
      result.push(result[0])
    }
    return [result]
  }
}

export default Parse
