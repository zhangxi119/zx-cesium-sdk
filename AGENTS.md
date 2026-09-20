# AGENTS.md

## 开发要求
 - 完成文档调整时需要自动更新使用文档，html格式的测试用例
 - 核心类名、方法名、属性名等请使用驼峰命名法，且核心功能点需要添加简体中文注释

## 自定义 Overlay 开发流程

1. 完成要求业务需求开发

2. **创建测试用例**：在 `examples/vector/` 下新建 `xxx_line.html`，配置 viewer（`enableMouseOver`、`enableMouseMovePick`）、VectorLayer、坐标数据、overlay 实例及 tooltip 回调

3. **创建使用文档**：在 `examples/vector/` 下新建 `xxx_line.md`，包含构造函数、options 配置表、方法说明、事件、示例代码、注意事项

4. **注册菜单项**：在 `examples/list.js` 中添加示例页面入口

5. **构建验证**：运行 `npx gulp build` 确认无编译错误，检查 dist 产物中类名已正确导出