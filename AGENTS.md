# AGENTS.md

## 开发要求
 - 每次调整完js文件时需要再顶部更新作者信息，更新时间。文件头部必须包含 `@Author`、`@Last Modified By`、`@Last Modified Time` 三行（与 psioniq File Header 插件模板一致），否则插件保存时无法自动更新
 - 完成文档调整时需要自动更新使用文档，html格式的测试用例

## 自定义 Overlay 开发流程

1. 完成要求业务需求开发

2. **创建测试用例**：在 `examples/vector/` 下新建 `xxx_line.html`，配置 viewer（`enableMouseOver`、`enableMouseMovePick`）、VectorLayer、坐标数据、overlay 实例及 tooltip 回调

3. **创建使用文档**：在 `examples/vector/` 下新建 `xxx_line.md`，包含构造函数、options 配置表、方法说明、事件、示例代码、注意事项

4. **注册菜单项**：在 `examples/list.js` 中添加示例页面入口

5. **构建验证**：运行 `npx gulp build` 确认无编译错误，检查 dist 产物中类名已正确导出