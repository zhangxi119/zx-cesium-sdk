# 标绘要素 🌎

## DC.AttackArrow

> 攻击箭头要素，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let attackArrow = new DC.AttackArrow('-90.0,32.0;-94.0,36.0;-94.0,38.0')
```

### creation

- **_constructor(positions)_**

  构造函数

  - 参数
    - `{String|Array<Position|Number|String|Object>} positions`：坐标串
  - 返回值 `attackArrow`

### properties

- `{Array<Position>} positions`：坐标串

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](./overlay-vector#dc-polygon)
  - 返回值 `this`

## DC.DoubleArrow

> 双箭头要素，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let doubleArrow = new DC.DoubleArrow('-90.0,32.0;-94.0,36.0;-94.0,38.0')
```

### creation

- **_constructor(positions)_**

  构造函数

  - 参数
    - `{String|Array<Position|Number|String|Object>} positions`：坐标串
  - 返回值 `doubleArrow`

### properties

- `{Array<Position>} positions`：坐标串

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](./overlay-vector#dc-polygon)
  - 返回值 `this`

## DC.FineArrow

> 直箭头要素，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let fineArrow = new DC.FineArrow('-90.0,32.0;-94.0,36.0')
```

### creation

- **_constructor(positions)_**

  构造函数

  - 参数
    - `{String|Array<Position|Number|String|Object>} positions`：坐标串
  - 返回值 `fineArrow`

### properties

- `{Array<Position>} positions`：坐标串

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](./overlay-vector#dc-polygon)
  - 返回值 `this`

## DC.GatheringPlace

> 聚集地要素，继承于[Overlay](./overlay-vector#dc-overlay)

### example

```js
let gatheringPlace = new DC.GatheringPlace('-90.0,32.0;-94.0,36.0')
```

### creation

- **_constructor(positions)_**

  构造函数

  - 参数
    - `{String|Array<Position|Number|String|Object>} positions`：坐标串
  - 返回值 `gatheringPlace`

### properties

- `{Array<Position>} positions`：坐标串

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](./overlay-vector#dc-polygon)
  - 返回值 `this`

## DC.TailedAttackArrow

> 燕尾攻击箭头，继承于[AttackArrow](#dc-attackarrow)

### example

```js
let tailedAttackArrow = new DC.TailedAttackArrow('-90.0,32.0;-94.0,36.0;-94.0,38.0')
```

### creation

- **_constructor(positions)_**

  构造函数

  - 参数
    - `{String|Array<Position|Number|String|Object>} positions`：坐标串
  - 返回值 `tailedAttackArrow`

### properties

- `{Array<Position>} positions`：坐标串

### methods

- **_setStyle(style)_**

  设置样式

  - 参数
    - `{Object} style`：样式，[详细使用说明](./overlay-vector#dc-polygon)
  - 返回值 `this`
