/**
 * 注册模块解析/加载钩子（见 `cesium-alias-hooks.mjs`）
 *
 * 职责：① `cesium` → `@cesium/engine` 别名；② 兼容源码中的目录导入与省略扩展名导入；
 *       ③ 为 png/glsl/scss 等资源返回占位模块。
 *
 * 用法：`npm run verify:perf`
 *   （等价于 `node --import ./verify/register.mjs verify/<脚本>.mjs`）
 */
import { register } from 'node:module'

register('./cesium-alias-hooks.mjs', import.meta.url)
