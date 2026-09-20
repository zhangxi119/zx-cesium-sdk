import { Cesium } from '../../libs'

// C
export const CallbackProperty = Cesium.CallbackProperty
export const Cartesian2 = Cesium.Cartesian2
export const Cartesian3 = Cesium.Cartesian3
export const Cartesian4 = Cesium.Cartesian4
export const Cartographic = Cesium.Cartographic
export const ClassificationType = Cesium.ClassificationType
export const ClippingPlane = Cesium.ClippingPlane
export const ClippingPlaneCollection = Cesium.ClippingPlaneCollection
export const ClippingPolygon = Cesium.ClippingPolygon
export const ClippingPolygonCollection = Cesium.ClippingPolygonCollection
export const Color = Cesium.Color
export const ColorMaterialProperty = Cesium.ColorMaterialProperty
export const createElevationBandMaterial = Cesium.createElevationBandMaterial
export const createGooglePhotorealistic3DTileset =
  Cesium.createGooglePhotorealistic3DTileset
export const CustomShader = Cesium.CustomShader
export const CustomShaderMode = Cesium.CustomShaderMode
export const CustomShaderTranslucencyMode = Cesium.CustomShaderTranslucencyMode
// E
export const Ellipsoid = Cesium.Ellipsoid
// G
export const GeographicTilingScheme = Cesium.GeographicTilingScheme
// H
export const HeightReference = Cesium.HeightReference
export const HorizontalOrigin = Cesium.HorizontalOrigin
// I
export const ImageMaterialProperty = Cesium.ImageMaterialProperty
// J
export const JulianDate = Cesium.JulianDate
// M
export const Matrix2 = Cesium.Matrix2
export const Matrix3 = Cesium.Matrix3
export const Matrix4 = Cesium.Matrix4
export const Material = Cesium.Material
export const ModelAnimationLoop = Cesium.ModelAnimationLoop
// P
export const PolylineArrowMaterialProperty =
  Cesium.PolylineArrowMaterialProperty
/**
 * `PolylineDashMaterialProperty` —— **DC 增强实现**（非 Cesium 原生直出）
 *
 * Cesium 原生的 `PolylineDash` 材质在片元着色器里对虚线掩码做硬二值化，端面呈硬边锯齿；
 * 且该锯齿位于折线四边形**内部**，MSAA 无法处理（MSAA 只作用于三角形边缘）。
 *
 * DC 的实现（`material/property/polyline/PolylineDashAAMaterialProperty`）
 * 继承自 `Cesium.PolylineDashMaterialProperty`，构造参数/取值/`instanceof` 完全等价，
 * 仅把材质类型指向带解析式抗锯齿的 `PolylineDashAA`（用 `fwidth` + 3 点箱式滤波求覆盖率）。
 *
 * 因此这里**直接替换**该导出：既有调用方无需改动即可获得平滑虚线。
 * 需要 Cesium 原始行为时，可从 `cesium` 直接引入 `PolylineDashMaterialProperty`。
 */
export { default as PolylineDashMaterialProperty } from '../material/property/polyline/PolylineDashAAMaterialProperty'
export const PolylineGlowMaterialProperty = Cesium.PolylineGlowMaterialProperty
export const PolylineOutlineMaterialProperty =
  Cesium.PolylineOutlineMaterialProperty
// R
export const Rectangle = Cesium.Rectangle
export const Resource = Cesium.Resource
// S
export const SceneMode = Cesium.SceneMode
export const SkyBox = Cesium.SkyBox
export const ShadowMode = Cesium.ShadowMode
// T
export const TilesetStyle = Cesium.Cesium3DTileStyle
// U
export const UniformType = Cesium.UniformType
// V
export const VerticalOrigin = Cesium.VerticalOrigin
// W
export const WebMercatorTilingScheme = Cesium.WebMercatorTilingScheme
export const writeTextToCanvas = Cesium.writeTextToCanvas
