# DC-SDK

<p>
<img src="https://img.shields.io/github/actions/workflow/status/zhangxi119/zx-cesium-sdk/build.yml"/>
<img src="https://img.shields.io/badge/license-Apache%202-blue"/>
<a href="https://www.npmjs.com/package/@dvgis/dc-sdk" target="_blank">
 <img src="https://img.shields.io/npm/v/@dvgis/dc-sdk?color=orange&logo=npm" />
</a>
<a href="https://www.npmjs.com/package/@dvgis/dc-sdk" target="_blank">
 <img src="https://img.shields.io/npm/dt/@dvgis/dc-sdk?logo=npm"/>
</a>
<a href="https://resource.dvgis.cn/dc-docs/zh/" target="_blank">
 <img src="https://img.shields.io/badge/docs-online-yellow.svg"/>
</a>
<a href="http://dc.dvgis.cn" target="_blank">
 <img src="https://img.shields.io/badge/demo-online-red.svg"/>
</a>
</p>


[**🇨🇳 中文**](./README_zh.md) | [**🇬🇧English**](./README.md)

`DC-SDK` is based on the open source project `Cesium` for the second development of two three-dimensional `WebGis` application framework , the framework optimizes the use of `Cesium` and adds some additional features , designed for developers to quickly build `WebGis` application.

```warning
Tips：This SDK is JS+GIS framework package. Developers need to have some front-end technology and GIS related technology
```


## Run examples

```shell
  yarn run build
  yarn run server
```

## Installation

`NPM / YARN` **_`(Recommend)`_**

Installing with NPM or YARN is recommended and it works seamlessly with webpack.

```shell
yarn add @dvgis/dc-sdk
-------------------------
npm install @dvgis/dc-sdk
```

```js
import * as DC from '@dvgis/dc-sdk'
import '@dvgis/dc-sdk/dist/dc.min.css'
```

`CDN`

[Resources](https://github.com/zhangxi119/zx-cesium-sdk/releases)

```html
<script src="https://cdn.jsdelivr.net/npm/@dvgis/dc-sdk/dist/dc.min.js"></script>
<link
  href="https://cdn.jsdelivr.net/npm/@dvgis/dc-sdk/dist/dc.min.css"
  rel="stylesheet"
  type="text/css"
/>
```

```
Please put the resources in the project root directory libs/dc-sdk, if you put it in other directory, the framework will not run properly.
```

## Configuration

> The configuration is mainly used in the `NPM / YARN` way

Since the `DC` framework sets `CESIUM_BASE_URL` to `./libs/dc-sdk/resources/` , you need to copy `Cesium` related static resources files: `Assets` , `Workers` , `ThirdParty `to `libs/dc-sdk/resources` directory of the project to ensure that the 3D scene can be rendered properly. You can also use `DC.config.baseUrl` to set the static resource base related to `Cesium` .

`Webpack`

[Project Template](https://github.com/cavencj/dc-vue-app)

```js
// webpack.config.js
const path = require('path')
const CopywebpackPlugin = require('copy-webpack-plugin')
const dvgisDist = './node_modules/@dvgis'

module.exports = {
  plugins: [
    new CopyWebpackPlugin([
      {
        from: path.join(dvgisDist, 'dc-sdk/dist/resources'),
        to: 'libs/dc-sdk/resources',
      },
    ]),
  ],
}
```

`Vue2.x`

[Project Template](https://github.com/dvgis/dc-vue)

```js
// vue.config.js
const path = require('path')
const CopywebpackPlugin = require('copy-webpack-plugin')
const dvgisDist = './node_modules/@dvgis'
module.exports = {
  chainWebpack: (config) => {
    config.plugin('copy').use(CopywebpackPlugin, [
      [
        {
          from: path.join(dvgisDist, 'dc-sdk/dist/resources'),
          to: 'libs/dc-sdk/resources',
        },
      ],
    ])
  },
}
```

`Vue3.x`

[Project Template](https://github.com/dvgis/dc-vue-next)

```js
// vue.config.js
const path = require('path')
const CopywebpackPlugin = require('copy-webpack-plugin')
const dvgisDist = './node_modules/@dvgis'
module.exports = {
  chainWebpack: (config) => {
    config.plugin('copy').use(CopywebpackPlugin, [
      {
        patterns: [
          {
            from: path.join(dvgisDist, 'dc-sdk/dist/resources'),
            to: path.join(__dirname, 'dist', 'libs/dc-sdk/resources'),
          },
        ],
      },
    ])
  },
}
```

`vite`

[Project Template](https://github.com/dvgis/dc-vite)

```js
// vite.config.js
import { defineConfig } from 'vite'
import DC from '@dvgis/vite-plugin-dc'

export default defineConfig({
  plugins: [DC()],
})
```


## Start

```js
global.DC = DC
DC.ready({}).then(()=>{
    let viewer = new DC.Viewer()
})
```

## Demo

|           ![picture](https://dc.dvgis.cn/examples/previews/baselayer/online/baidu.png)           |     ![picture](http://dc.dvgis.cn/examples/previews/baselayer/online/tdt.png)      |     ![picture](http://dc.dvgis.cn/examples/previews/baselayer/online/arcgis.png?v=3)     |        ![picture](http://dc.dvgis.cn/examples/previews/mini-scene/china.gif)         |
|:------------------------------------------------------------------------------------------------:|:----------------------------------------------------------------------------------:|:----------------------------------------------------------------------------------------:|:------------------------------------------------------------------------------------:|
|               ![picture](http://dc.dvgis.cn/examples/previews/mini-scene/dfmz.gif)               |    ![picture](http://dc.dvgis.cn/examples/previews/mini-scene/factory.gif)     |        ![picture](http://dc.dvgis.cn/examples/previews/layer/cluster_circle.gif)         | ![picture](http://dc.dvgis.cn/examples/previews/model/3dtiles/shp_custom_shader.gif) |
|        ![picture](http://dc.dvgis.cn/examples/previews/overlay/polyline/image_trail.gif)         | ![picture](http://dc.dvgis.cn/examples/previews/overlay/others/wall_trail.gif) |       ![picture](http://dc.dvgis.cn/examples/previews/overlay/primitive/water.gif)       |      ![picture](http://dc.dvgis.cn/examples/previews/scene-ext/tools/plot.png)       |

[More>>](http://dc.dvgis.cn/#/examples)

## Thanks
