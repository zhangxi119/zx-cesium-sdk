# 场景效果 🌎

## DC.Weather

> 天气效果

### example

```js
let weather = new DC.Weather(viewer)
```

### creation

- **_constructor(viewer)_**

  构造函数

  - 参数
    - `{Viewer} viewer`：3D 场景
  - 返回值 `weather`

### properties

- [`{Rain} rain`](#rain)：雨天 **_`readonly`_**
- [`{Snow} snow`](#snow)：雪天 **_`readonly`_**
- [`{Fog} fog`](#fog)：雾天 **_`readonly`_**
- [`{Cloud} cloud`](#cloud)：云 **_`readonly`_**

## Rain

> 雨天效果

### example

```js
weather.rain.enable = true
weather.rain.speed = 2
```

### properties

- `{Boolean} enable`：是否启用
- `{Number} speed`：速度
- `{Number} mixNum`：混合比例
- `{String} type`：天气类型 **_`readonly`_**

## Snow

> 雪天效果

### example

```js
weather.snow.enable = true
weather.snow.speed = 2
```

### properties

- `{Boolean} enable`：是否启用
- `{Number} speed`：速度
- `{String} type`：天气类型 **_`readonly`_**

## Fog

> 雾天效果

### example

```js
weather.fog.enable = true
weather.fog.color = DC.Color.BLACK
```

### properties

- `{Boolean} enable`：是否启用
- `{Color} color`：颜色，
- `{Object} fogByDistance`：距离可见，默认： `{ near: 10, nearValue: 0, far: 2000, farValue: 1.0 }`
- `{String} type`：天气类型 **_`readonly`_**

## Cloud

> 云效果

### example

```js
weather.cloud.enable = true
weather.cloud.rotateAmount = 0.02
```

### properties

- `{Boolean} enable`：是否启用
- `{Number} rotateAmount`：移动增量，可为负数
- `{String} type`：天气类型 **_`readonly`_**

## DC.Effect

> 效果类

### example

```js
let effect = new DC.Effect(viewer)
```

### creation

- **_constructor(viewer)_**

  构造函数

  - 参数
    - `{Viewer} viewer`：3D 场景
  - 返回值 `effect`

### properties

- [`{BlackAndWhite} blackAndWhite`](#blackandwhite)：黑白 **_`readonly`_**
- [`{Bloom} bloom`](#bloom)：泛光 **_`readonly`_**
- [`{Brightness} brightness`](#brightness)：明亮 **_`readonly`_**
- [`{DepthOfField} depthOfField`](#depthoffield)：景深 **_`readonly`_**
- [`{LensFlare} lensFlare`](#lensflare)：镜头耀斑 **_`readonly`_**
- [`{NightVision} night`](#nightvision)：夜视 **_`readonly`_**
- [`{Silhouette} silhouette`](#silhouette)：描边 **_`readonly`_**
- [`{SkyLine} skyLine`](#skyline)：天际线 **_`readonly`_**

## BlackAndWhite

> 黑白效果

### example

```js
effect.blackAndWhite.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{Number} gradations`：强度
- `{Array} selected`：设置后期作用的覆盖物
- `{String} type`：效果类型 **_`readonly`_**

## Bloom

> 泛光效果

### example

```js
effect.bloom.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{Number} contrast`：对比度
- `{Number} brightness`：亮度
- `{Boolean} glowOnly`：只发光
- `{Number} delta`：Delta
- `{Number} sigma`：Sigma
- `{Number} stepSize`：StepSize
- `{Array} selected`：设置后期作用的覆盖物
- `{String} type`：效果类型 **_`readonly`_**

## Brightness

> 明亮效果

### example

```js
effect.brightness.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{Number} intensity`：强度
- `{Array} selected`：设置后期作用的覆盖物
- `{String} type`：效果类型 **_`readonly`_**

## DepthOfField

> 景深效果

### example

```js
effect.depthOfField.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{Number} focalDistance`：焦距
- `{Number} delta`：Delta
- `{Number} sigma`：Sigma
- `{Number} stepSize`：StepSize
- `{Array} selected`：设置后期作用的覆盖物
- `{String} type`：效果类型 **_`readonly`_**

## LensFlare

> 镜头耀斑效果

### example

```js
effect.lensFlare.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{Number} intensity`：强度
- `{Number} distortion`：扭曲度
- `{Number} dirtAmount`：分散度
- `{Number} haloWidth`：光圈宽度
- `{Array} selected`：设置后期作用的覆盖物
- `{String} type`：效果类型 **_`readonly`_**

## NightVision

> 夜视效果

### example

```js
effect.night.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{Array} selected`：设置后期作用的覆盖物
- `{String} type`：效果类型 **_`readonly`_**

## Silhouette

> 描边效果

### example

```js
effect.silhouette.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{Color} color`：颜色
- `{Number} length`：长度
- `{Array} selected`：设置后期作用的覆盖物
- `{String} type`：效果类型 **_`readonly`_**

## SkyLine

> 天际线效果

### example

```js
effect.skyLine.enable = true
```

### properties

- `{Boolean} enable`：是否启用
- `{Number} depthThreshold`：深度阈值
- `{Color} color`：颜色
- `{String} type`：效果类型 **_`readonly`_**

## DC.CircleScan

> 扫描圈，继承于[Animation](./effect-animation#animation)

### example

```js
let circleScan = new DC.CircleScan(viewer, '120, 20', 200)
circleScan.start()
```

### creation

- **_constructor(viewer,position,radius,options)_**

  构造函数

  - 参数
    - `{Viewer} viewer`：场景
    - `{DC.Position} position`：位置
    - `{Number} radius`：半径
    - `{Object} options`：属性
  - 返回值 `circleScan`

```js
// options（属性可选）
const options = {
  "color": DC.Color.BLUE,// 颜色
  "speed": 5// 速度
}
```

### properties

- `{String} type`：动画类型 **_`readonly`_**

### methods

- **_start()_**

  开始动画

  - 返回值 `this`

- **_stop()_**

  停止动画

  - 返回值 `this`

## DC.RadarScan

> 雷达扫描，继承于[Animation](./effect-animation#animation)

### example

```js
let radarScan = new DC.RadarScan(viewer, '120, 20', 200)
radarScan.start()
```

### creation

- **_constructor(viewer,position,radius,options)_**

  构造函数

  - 参数
    - `{Viewer} viewer`：场景
    - `{DC.Position} position`：位置
    - `{Number} radius`：半径
    - `{Object} options`：属性
  - 返回值 `radarScan`

```js
// options（属性可选）
const options = {
  "color": DC.Color.BLUE,// 颜色
  "speed": 5// 速度
}
```

### properties

- `{String} type`：动画类型 **_`readonly`_**

### methods

- **_start()_**

  开始动画

  - 返回值 `this`

- **_stop()_**

  停止动画

  - 返回值 `this`
