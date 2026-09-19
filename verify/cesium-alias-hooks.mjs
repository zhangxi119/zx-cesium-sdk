/**
 * Node 模块解析钩子
 *
 * 职责一：把 `cesium` 说明符别名到 `@cesium/engine`
 *   原因：`cesium` 伞包会在模块顶层加载 `@cesium/widgets`（含 knockout），
 *   后者在无完整 DOM/Canvas 的环境下无法初始化。
 *   而 DC-SDK 实际只使用 `@cesium/engine` 提供的符号（Entity / Cartesian3 / Transforms …），
 *   因此验证脚本中把 `cesium` 重定向到 `@cesium/engine` 即可在 Node 中加载 DC 产物。
 *
 * 职责二：兼容源码中的「打包器式」相对导入
 *   DC 源码依赖打包器的解析能力，存在两类 Node ESM 不支持的形式：
 *     1. 目录导入：`import { Cesium } from '../../libs'`（应解析到 `libs/index.js`）
 *     2. 省略扩展名：`import Util from './Util'`（应解析到 `./Util.js`）
 *   这里按候选顺序重试，使源码模块可直接在 Node 中被验证。
 *   仅对**相对说明符**生效，避免影响裸包说明符的解析。
 *
 * 该钩子仅用于本地验证，不影响任何构建产物。
 */
export async function resolve(specifier, context, nextResolve) {
  const target = specifier === 'cesium' ? '@cesium/engine' : specifier
  try {
    return await nextResolve(target, context)
  } catch (err) {
    const isRelative = target.startsWith('./') || target.startsWith('../')
    if (!isRelative) {
      throw err
    }
    /**
     * 依次尝试：目录索引 → 补 .js 扩展名
     */
    for (const candidate of [`${target}/index.js`, `${target}.js`]) {
      try {
        return await nextResolve(candidate, context)
      } catch {
        // 继续尝试下一个候选
      }
    }
    throw err
  }
}

/**
 * 加载钩子：为非 JS 资源返回占位模块
 *
 * DC 源码通过 esbuild 插件内联图片（`esbuild-plugin-inline-image`）、
 * GLSL（`esbuild-plugin-glsl`）与样式（`esbuild-plugin-sass`），
 * 因此源码中存在 `import x from './circle.png'` 这类语句；
 * Node 无法直接加载这些扩展名。
 *
 * 验证脚本只关注逻辑与几何行为，不编译着色器，
 * 故统一返回空字符串作为默认导出即可。
 *
 * @param {string} url
 * @param {object} context
 * @param {Function} nextLoad
 */
export async function load(url, context, nextLoad) {
  if (/\.(png|jpe?g|gif|svg|webp|glsl|scss|css)(\?.*)?$/i.test(url)) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default ""',
    }
  }
  return nextLoad(url, context)
}
