import { Cesium } from '../../../../libs'

/**
 * 抗锯齿虚线材质属性
 *
 * 与 `Cesium.PolylineDashMaterialProperty` 的**构造参数、属性描述符、取值逻辑完全一致**
 * （直接继承自它），唯一区别是 `getType()` 返回 DC 注册的抗锯齿材质 `PolylineDashAA`。
 *
 * 因此可以**直接替换**使用：
 * ```js
 * line.setStyle({ material: new DC.PolylineDashAAMaterialProperty({ color, dashLength }) })
 * ```
 * 并且 `instanceof Cesium.PolylineDashMaterialProperty` 仍然成立，
 * 不会影响任何基于基类的判断。
 *
 * 材质实现见 `shader/polyline/PolylineDashAAMaterial.glsl`（虚线端面解析式抗锯齿）。
 */
class PolylineDashAAMaterialProperty extends Cesium.PolylineDashMaterialProperty {
  /**
   * 返回材质类型（指向 DC 注册的抗锯齿材质）
   * @param {Cesium.JulianDate} time
   * @returns {string}
   */
  getType(time) {
    return Cesium.Material.PolylineDashAAType
  }
}

export default PolylineDashAAMaterialProperty
