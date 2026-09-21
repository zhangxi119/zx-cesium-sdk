# 原生 API 🌎

Cesium 原生类扩展与重命名

:::warning
该文档只列举部分常用的内部类，如果需要更多的 Cesium 内部类，可以通过接口 ` getLib('cesium')` 获取到 Cesium
对象
:::

## DC.CallbackProperty

> 回调属性，用户通过自定义回调函数来返回需要的值。回调函数中，用户可以使用 time 给定
> value，也可以自定设置。[详细使用说明](http://resource.dvgis.cn/cesium-docs/CallbackProperty.html)

```js
let position = new DC.Position(120, 20)
let point = new DC.Point(position)
let size = 0
point.setStyle({
  pixelSize: new DC.CallbackProperty((time) => {
    size += 1
    if (size == 10) {
      size = 0
    }
    return size
  }),
})
```

## DC.Cartesian2

> 一个二维笛卡尔坐标点。[详细使用说明](http://resource.dvgis.cn/cesium-docs/Cartesian2.html)

### example

```js
let c = new DC.Cartesian2(1, 1)
```

## DC.Cartesian3

> 一个三维笛卡尔坐标点。[详细使用说明](http://resource.dvgis.cn/cesium-docs/Cartesian3.html)

### example

```js
let c = new DC.Cartesian3(1, 1, 1)
```

## DC.Cartesian4

> 一个四维笛卡尔坐标点。[详细使用说明](http://resource.dvgis.cn/cesium-docs/Cartesian4.html)

### example

```js
let c = new DC.Cartesian4(1, 1, 1, 1)
```

## DC.Matrix2

>
一个2x2矩阵，可作为列优先顺序数组进行索引。构造函数参数采用行优先顺序，以提高代码可读性。[详细使用说明](http://resource.dvgis.cn/cesium-docs/Matrix2.html)

### example

```js
let m = new DC.Matrix2()
```

## DC.Matrix3

>
一个3x3矩阵，可作为列优先顺序数组进行索引。构造函数参数采用行优先顺序，以提高代码可读性。[详细使用说明](http://resource.dvgis.cn/cesium-docs/Matrix3.html)

### example

```js
let m = new DC.Matrix3()
```

## DC.Matrix4

>
一个4x4矩阵，可作为列优先顺序数组进行索引。构造函数参数采用行优先顺序，以提高代码可读性。[详细使用说明](http://resource.dvgis.cn/cesium-docs/Matrix4.html)

### example

```js
let m = new DC.Matrix4()
```

## DC.Material

>
材质通过漫反射、镜面反射、法线、发光和透明度等组件的组合来定义表面外观。这些数值使用名为Fabric的JSON模式进行定义，该模式会在后台被解析并组装成GLSL着色器代码。[详细使用说明](http://resource.dvgis.cn/cesium-docs/Material.html)

### example

```js

let m = new DC.Material({
  fabric: {
    type: 'Color'
  }
})

let m_1 = new DC.Material({
  fabric: {
    type: 'Color',
    uniforms: {
      color: new DC.Color(1.0, 1.0, 0.0, 1.0)
    }
  }
});
```

## DC.SceneMode

> 指示场景是以3D、2D还是2.5D哥伦布视图显示。[详细使用说明](http://resource.dvgis.cn/cesium-docs/global.html#SceneMode)

### example

```js
const mode = DC.SceneMode.SCENE3D
```

## DC.SkyBox

> 天空盒。[详细使用说明](http://resource.dvgis.cn/cesium-docs/SkyBox.html)

### example

```js
scene.skyBox = new DC.SkyBox({
  sources: {
    positiveX: 'skybox_px.png',
    negativeX: 'skybox_nx.png',
    positiveY: 'skybox_py.png',
    negativeY: 'skybox_ny.png',
    positiveZ: 'skybox_pz.png',
    negativeZ: 'skybox_nz.png',
  },
})
```

### creation

- **_constructor(options)_**

  构造函数

  - 参数
    - `{Object} options`：配置
  - 返回值 `skyBox`

```js
//options(属性可选)
const options = {
  "sources": {},// 六个面的贴图
  "show": true//显示
}
```

### properties

- `{Object} sources`：六个面的贴图
- `{Boolean} show`：显示

## DC.Color

> 颜色类。[详细使用说明](http://resource.dvgis.cn/cesium-docs/Color.html)

### example

```js
let red = DC.Color.RED
```

## DC.TilesetStyle

> tileset 样式，用于设置 3d-tiles
> 的样式，Cesium3DTileStyle重命名。 [详细使用说明](http://resource.dvgis.cn/cesium-docs/Cesium3DTileStyle.html)

### example

```js
let style = new DC.TilesetStyle()
style.color = {
  conditions: [
    ['${floor} >= 5', 'rgb(198, 106, 11)'],
    ['true', 'rgb(127, 59, 8)'],
  ],
}
```

## DC.JulianDate

> 朱莉安日历。[详细参考](http://resource.dvgis.cn/cesium-docs/JulianDate.html)

```js
let date = DC.JulianDate.now()
```

### static methods

- **_now()_**

  当前朱莉安时间

  - 返回值 `date`

- **_fromDate(date)_**

  通过 Js 时间创建朱莉安时间

  - 参数
    - `{Date} date`：Js 时间
  - 返回值 `date`

## DC.Rectangle

> 矩形相关函数，[详细使用说明](http://resource.dvgis.cn/cesium-docs/Rectangle.html)

### example

```js
let r = DC.Rectangle.fromDegrees(10, 20, 12, 31)
```


