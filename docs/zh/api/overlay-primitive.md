# 图元要素 🌎

## DC.PointPrimitive

> 点位图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let position = new DC.Position(120, 20)
let point = new DC.PointPrimitive(position)
point.setStyle({
  pixelSize: 10,
})
```

### creation

- **_constructor(position)_**

  构造函数

  - 参数
    - `{Position|Number|String|Object} position`：坐标
  - 返回值 `point`

### properties

- `{Position|Number|String|Object} position`：坐标

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](http://resource.dvgis.cn/cesium-docs/PointGraphics.html)
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "pixelSize": 1, //像素大小
  "heightReference": 0, //高度参照，0：位置无参照，位置是绝对的，1：位置固定在地形上 2：位置高度是指地形上方的高度。
  "color": DC.Color.WHITE, //颜色
  "outlineColor": DC.Color.WHITE, //边框颜色
  "outlineWidth": 0, //边框大小，
  "scaleByDistance": {
    "near": 0, //最近距离
    "nearValue": 0, //最近距离值
    "far": 1, //最远距离值
    "farValue": 0 //最远距离值
  }, //根据距离设置比例
  "translucencyByDistance": {
    "near": 0, //最近距离
    "nearValue": 0, //最近距离值
    "far": 1, //最远距离值
    "farValue": 0 //最远距离值
  }, //根据距离设置透明度
  "distanceDisplayCondition": {
    "near": 0, //最近距离
    "far": Number.MAX_VALUE //最远距离
  }, //根据距离设置可见
  "disableDepthTestDistance": 0 // 深度检测距离，用于防止剪切地形，设置为零时，将始终应用深度测试。设置为Number.POSITIVE_INFINITY时，永远不会应用深度测试。
}
```

## DC.BillboardPrimitive

> 图标图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let position = new DC.Position(120, 20)
let billboard = new DC.BillboardPrimitive(position, '***/**.png')
billboard.size = [20, 20]
```

### creation

- **_constructor(position,icon)_**

  构造函数

  - 参数
    - `{Position|Number|String|Object} position`：坐标
    - `{String} icon`：图标地址
  - 返回值 `billboard`

### properties

- `{Position} position`：坐标
- `{String} icon`：图标地址
- `{Array<Number>} size`：图标大小

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](http://resource.dvgis.cn/cesium-docs/Billboard.html)
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "heightReference": 0, //高度参照，0：位置无参照，位置是绝对的，1：位置固定在地形上 2：位置高度是指地形上方的高度。
  "scale": 1, //比例
  "pixelOffset": { "x": 0, "y": 0 }, //偏移像素
  "rotation": 0, //旋转角度
  "translucencyByDistance": {
    "near": 0, //最近距离
    "nearValue": 0, //最近距离值
    "far": 1, //最远距离值
    "farValue": 0 //最远距离值
  }, //根据距离设置透明度
  "scaleByDistance": {
    "near": 0, //最近距离
    "nearValue": 0, //最近距离值
    "far": 1, //最远距离值
    "farValue": 0 //最远距离值
  }, //根据距离设置比例
  "distanceDisplayCondition": {
    "near": 0, //最近距离
    "far": Number.MAX_VALUE //最远距离
  }, //根据距离设置可见
  "disableDepthTestDistance": 0 // 深度检测距离，用于防止剪切地形，设置为零时，将始终应用深度测试。设置为Number.POSITIVE_INFINITY时，永远不会应用深度测试。
}
```

## DC.BounceBillboardPrimitive

> 跳动图标图元，继承于[BillboardPrimitive](#dc-billboardprimitive)

### example

```js
let position = new DC.Position(120, 20)
let billboard = new DC.BounceBillboardPrimitive(position, '***/**.png')
billboard.size = [20, 20]
```

### creation

- **_constructor(position,icon)_**

  构造函数

  - 参数
    - `{Position|Number|String|Object} position`：坐标
    - `{String} icon`：图标地址
  - 返回值 `billboard`

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](http://resource.dvgis.cn/cesium-docs/Billboard.html)
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "maxOffsetY": 10, //垂直方向最大平移量
  "offsetAmount": 0.1 //垂直方向每帧平移量
  // 其他样式参考 BillboardPrimitive 样式
}
```

## DC.LabelPrimitive

> 标签图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let position = new DC.Position(120, 20)
let Label = new DC.LabelPrimitive(position, 'test')
```

### creation

- **_constructor(position,text)_**

  构造函数

  - 参数
    - `{Position|Number|String|Object} position`：坐标
    - `{String} text`：文本
  - 返回值 `label`

### properties

- `{Position|Number|String|Object} position`：坐标
- `{String} text`：文本

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](http://resource.dvgis.cn/cesium-docs/Label.html)
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "font": "30px sans-serif", // CSS 字体设置
  "scale": 1, //比例
  "pixelOffset": { "x": 0, "y": 0 }, //偏移像素
  "heightReference": 0, //高度参照，0：位置无参照，位置是绝对的，1：位置固定在地形上 2：位置高度是指地形上方的高度。
  "showBackground": false, //是否显示背景
  "backgroundColor": DC.Color.BLACK, //背景颜色
  "backgroundPadding": { "x": 0, "y": 0 }, //背景间隙
  "fillColor": DC.Color.BLACK, //文字颜色
  "outlineColor": DC.Color.WHITE, //边框颜色
  "outlineWidth": 0, //边框大小，
  "scaleByDistance": {
    "near": 0, //最近距离
    "nearValue": 0, //最近距离值
    "far": 1, //最远距离值
    "farValue": 0 //最远距离值
  }, //根据距离设置比例
  "translucencyByDistance": {
    "near": 0, //最近距离
    "nearValue": 0, //最近距离值
    "far": 1, //最远距离值
    "farValue": 0 //最远距离值
  }, //根据距离设置透明度
  "distanceDisplayCondition": {
    "near": 0, //最近距离
    "far": Number.MAX_VALUE //最远距离
  }, //根据距离设置可见
  "disableDepthTestDistance": 0 // 深度检测距离，用于防止剪切地形，设置为零时，将始终应用深度测试。设置为Number.POSITIVE_INFINITY时，永远不会应用深度测试。
}
```

## DC.BounceLabelPrimitive

> 跳动文本图元，继承于[LabelPrimitive](#dc-labelprimitive)

### example

```js
let position = new DC.Position(120, 20)
let label = new DC.BounceLabelPrimitive(position, 'test')
```

### creation

- **_constructor(position,text)_**

  构造函数

  - 参数
    - `{Position|Number|String|Object} position`：坐标
    - `{String} text`：文本
  - 返回值 `label`

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](http://resource.dvgis.cn/cesium-docs/Label.html)
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "maxOffsetY": 10, //垂直方向最大平移量
  "offsetAmount": 0.1 //垂直方向每帧平移量
  // 其他样式参考 LabelPrimitive 样式
}
```

## DC.PolylinePrimitive

> 线图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let polyline = new DC.PolylinePrimitive('120,20;120,30')
polyline.setStyle({
  width: 10,
})
```

### creation

- **_constructor(positions)_**

  构造函数

  - 参数
    - `{String|Array<Position|Number|String|Object>} positions`：坐标串
  - 返回值 `polyline`

### properties

- `{String|Array<Position|Number|String|Object>} positions`：坐标串
- `{Position} center`：中心点 **_`readonly`_**
- `{Number} distance`：距离,单位：米 **_`readonly`_**

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](http://resource.dvgis.cn/cesium-docs/Polyline.html)
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "width": 1, //线宽
  "material": DC.Color.WHITE, //材质
  "clampToGround": false, //是否贴地
  "shadows": 0, //阴影类型，0：禁用、1：启用 、2：投射、3：接受
  "distanceDisplayCondition": {
    "near": 0, //最近距离
    "far": Number.MAX_VALUE //最远距离
  }, //根据距离设置可见
  "classificationType": 2, //分类 是否影响地形，3D切片或同时影响这两者。0:地形、1:3D切片、2：两者
  "zIndex": 0 //层级
}
```

## DC.TrailLinePrimitive

> 轨迹线图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let trailLinePrimitive = new DC.TrailLinePrimitive('120,20;120,30;122,30')
```

### creation

- **_constructor(positions,[width])_**

  构造函数

  - 参数
    - `{String|Array<Position|Number|String|Object>} positions`：坐标串
    - `{Number} width`：线宽，默认为 1
  - 返回值 `trailLine`

### properties

- `{String|Array<Position|Number|String|Object>} positions`：坐标串

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "speed": 5, //速度
  "color": DC.Color.WHITE //颜色
}
```

## DC.FlowLinePrimitive

> 流动线图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let flowLinePrimitive = new DC.FlowLinePrimitive('120,20;120,30;122,30')
```

### creation

- **_constructor(positions,[width])_**

  构造函数

  - 参数
    - `{String|Array<Position|Number|String|Object>} positions`：坐标串
    - `{Number} width`：线宽，默认为 1
  - 返回值 `flowLine`

### properties

- `{String|Array<Position|Number|String|Object>} positions`：坐标串

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "speed": 5, //速度
  "color": DC.Color.WHITE, //颜色
  "percent": 0.3, // 比例
  "gradient": 0.1 // 透明程度
}
```

## DC.ModelPrimitive

> 模型图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let position = new DC.Position(120, 20)
let model = new DC.ModelPrimitive(position, '**/**.glb')
```

### creation

- **_constructor(position, modelUrl)_**

  构造函数

  - 参数
    - `{Position|Number|String|Object} position`：坐标
    - `{String} modelUrl`：模型地址
  - 返回值 `model`

### properties

- `{Position|Number|String|Object} position`：坐标
- `{String} modelUrl`：模型地址

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](http://resource.dvgis.cn/cesium-docs/Model.html)
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "scale": 1, //比例
  "minimumPixelSize": 0, //指定模型的最小像素大小，而不考虑缩放
  "maximumScale": 0, //指定模型的最大比例
  "heightReference": 0, //高度参照，0：位置无参照，位置是绝对的，1：位置固定在地形上 2：位置高度是指地形上方的高度。
  "shadows": 0, //阴影类型，0：禁用、1：启用 、2：投射、3：接受
  "silhouetteColor": DC.Color.RED, //轮廓颜色
  "silhouetteSize": 0, //轮廓宽度
  "lightColor": DC.Color.RED, //模型着色时指定灯光颜色
  "distanceDisplayCondition": {
    "near": 0, //最近距离
    "far": Number.MAX_VALUE //最远距离
  } //根据距离设置可见
}
```

## DC.DiffuseWallPrimitive

> 扩散墙图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let position = new DC.Position(120, 20)
let wall = new DC.DiffuseWallPrimitive(position, 2000, 1000)
```

### creation

- **_constructor(center, radius, height)_**

  构造函数

  - 参数
    - `{Position|Number|String|Object} center`：圆心
    - `{Number} radius`：半径
    - `{Number} height`：高度
  - 返回值 `wall`

### properties

- `{Position|Number|String|Object} center`：圆心
- `{Number} radius`：半径
- `{Number} height`：高度

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "minRadius": 10, // 动画最小半径
  "minHeight": 30, // 动画最小高度
  "color": DC.Color.RED, // 墙体颜色
  "slices": 128, //边数
  "speed": 10 //速度
}
```

## DC.ElecEllipsoidPrimitive

> 电弧球图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let elecEllipsoid = new DC.ElecEllipsoidPrimitive('120,20', {
  x: 2000,
  y: 2000,
  z: 2000
})
```

### creation

- **_constructor(position,radius)_**

  构造函数

  - 参数
    - `{Position|Number|String|Object} position`：坐标
    - `{Object} radius`:球半径
  - 返回值 `elecEllipsoid`

### properties

- `{Position|Number|String|Object} position`：坐标
- `{Object} radius`:球半径

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "speed": 5, //速度
  "color": DC.Color.WHITE //颜色
}
```

## DC.LightCylinderPrimitive

> 光柱要素，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let position = new DC.Position(120, 20)
let cylinder = new DC.LightCylinderPrimitive(position, 1000, 1, 100)
```

### creation

- **_constructor(center, length, topRadius, bottomRadius)_**

  构造函数

  - 参数
    - `{Position|Number|String|Object} center`：圆心
    - `{Number} length`：长度
    - `{Number} topRadius`：上半径
    - `{Number} bottomRadius`：下半径
  - 返回值 `cylinder`

### properties

- `{Position} center`：圆心
- `{Number} length`：长度
- `{Number} topRadius`：上半径
- `{Number} bottomRadius`：下半径

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "color": DC.Color.BLACK //颜色
}
```

## DC.ScanCirclePrimitive

> 扫描圆图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let scanCirclePrimitive = new DC.ScanCirclePrimitive('120,20', 1000)
```

### creation

- **_constructor(position,radius)_**

  构造函数

  - 参数
    - `{String|Position|Array|Object} position`：圆心
    - `{Number} radius`：半径
  - 返回值 `scanCircle`

### properties

- `{String|Position|Array|Object} position`：圆心
- `{Number} radius`：半径

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "speed": 5, //速度
  "color": DC.Color.WHITE //颜色
}
```

## DC.CloudPrimitive

> 云图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let position = new DC.Position(120, 20)
let cloud = new DC.CloudPrimitive(position)
cloud.setStyle({
  scale: {
    x: 25,
    y: 12,
  },
})
```

### creation

- **_constructor(position)_**

  构造函数

  - 参数
    - `{Position|Number|String|Object} position`：坐标
  - 返回值 `cloud`

### properties

- `{Position|Number|String|Object} position`：坐标

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](http://resource.dvgis.cn/cesium-docs/CloudCollection.html)
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "scale": { "x": 25, "y": 12 }, //云广告牌大小，单位：米，默认 12 x 8
  "maximumSize": { "x": 25, "y": 12, "z": 15 }, //云的最大体积，不设置时根据 scale 推导
  "slice": 0.36, //云渲染的横截面比例，取值 0 ~ 1，负数时不渲染横截面，默认 -1
  "brightness": 1.0, //亮度，默认 1.0
  "color": DC.Color.WHITE //颜色，默认 DC.Color.WHITE
}
```

## DC.WaterPrimitive

> 水面图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let water = new DC.WaterPrimitive('120,20;120,30;122,30')
water.setStyle({
  baseWaterColor: DC.Color.AQUA.withAlpha(0.3),
  normalMap: 'examples/images/icon/waterNormalsSmall.jpg',
  frequency: 1000.0,
  animationSpeed: 0.01,
  amplitude: 10,
  specularIntensity: 10,
})
```

### creation

- **_constructor(positions,[holes])_**

  构造函数

  - 参数
    - `{String|Array<Position|Number|String|Object>} positions`：坐标串
    - `{Array<Position|Number|String|Object>} holes`：洞面坐标
  - 返回值 `water`

### properties

- `{String|Array<Position|Number|String|Object>} positions`：坐标串

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](http://resource.dvgis.cn/cesium-docs/PolygonGraphics.html)
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "height": 1, //高度
  "extrudedHeight": 0, //拉升高度
  "stRotation": 0, //旋转角度
  "outline": false, //是否显示边框
  "closeTop": true, //顶面是否闭合
  "closeBottom": true, //底面是否闭合
  "classificationType": 2, //分类 是否影响地形，3D切片或同时影响这两者。0:地形、1:3D切片、2：两者
  "baseWaterColor": DC.Color.WHITE, // 水体颜色
  "blendColor": DC.Color.WHITE, // 混合颜色
  "specularMap": "", // 镜面图
  "normalMap": "", // 法线图
  "frequency": 1000, //波纹数量
  "animationSpeed": 0.03, // 动画速度
  "amplitude": 10, //水波振幅
  "specularIntensity": 10 //镜面反射强度
}
```

## DC.VideoPrimitive

> 视频图元，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let videoEl = new document.getElementById('video')
let videoPrimitive = new DC.VideoPrimitive('120,20;120,30;122,30', videoEl)
```

### creation

- **_constructor(positions,video)_**

  构造函数

  - 参数
    - `{String|Array<Position|Number|String|Object>} positions`：坐标串
    - `{Element} video`：视频节点
  - 返回值 `videoPrimitive`

### properties

- `{String|Array<Position|Number|String|Object>} positions`：坐标串
- `{Element} video`：视频节点

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](http://resource.dvgis.cn/cesium-docs/PolygonGraphics.html)
  - 返回值 `this`

```js
// style（属性可选）
const style = {
  "height": 0, //高度
  "extrudedHeight": 0, //拉升高度
  "closeTop": true, //顶面是否闭合
  "closeBottom": true, //底面是否闭合
  "classificationType": 2 //分类 是否影响地形，3D切片或同时影响这两者。0:地形、1:3D切片、2：两者
}
```
