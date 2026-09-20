import { defineConfig } from 'vitepress'
import zhConfig from './locales/zh.config.js'
import enConfig from './locales/en.config.js'

// 站点部署路径（dev / preview / build 共用），修改这里即可
const base = '/dc-docs/'

/**
 * 仅 dev 环境需要的兜底：Vite 的 base 中间件只接管以 base（含结尾斜杠）开头的请求，
 * 直接访问 `http://localhost:5173/dc-docs` 会在到达 VitePress 之前被 Vite 判为 404，
 * 因此这里在 base 中间件之前补一个 302，把它归一化到 `/dc-docs/`。
 *
 * preview（vitepress 自带的 polka 服务）与常规静态服务器都会把 `/dc-docs` 当作目录处理，
 * 不存在该问题，所以不需要 configurePreviewServer。
 */
function normalizeBaseSlash() {
  const bare = base.replace(/\/$/, '')

  return {
    name: 'zx-cesium-sdk:normalize-base-slash',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '/'
        const queryIndex = url.indexOf('?')
        const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex)
        if (pathname === bare) {
          res.writeHead(302, { Location: base + url.slice(pathname.length) })
          res.end()
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  base,
  cleanUrls: 'without-subfolders',
  head: [['link', { rel: 'icon', href: `${base}assets/favicon.png` }]],
  locales: {
    root: zhConfig,
    // en: enConfig,
  },
  themeConfig: {
    logo: '/assets/logo.svg',
    search: {
      provider: 'local',
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/zhangxi119/zx-cesium-sdk' },
    ],
  },
  vite: {
    plugins: [normalizeBaseSlash()],
  },
})
