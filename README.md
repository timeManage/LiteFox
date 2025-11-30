# 🦊 LiteFox - 轻量级接口调试工具

<p align="center">
  <b>一个运行在浏览器本地的 API 调试工具，完美解决跨域(CORS)限制。</b>
</p>

## 📖 简介

**LiteFox** 是一个基于 Chrome Extension (Manifest V3) 开发的静态网页版接口调试工具。它类似于 Postman 或 Apifox，但它**完全离线**、**开源**、**无后端服务器**。

利用浏览器扩展的特权，LiteFox 可以直接发起跨域请求，无需配置代理，是前端开发者调试接口、测试 API 的瑞士军刀。

## ✨ 核心特性

*   **🚫 彻底告别 CORS**：利用 Chrome Extension 权限，直接请求任意域名接口，不再受同源策略限制。
*   **📥 智能 cURL 导入**：支持解析标准的 cURL 命令（支持 URL、Headers、Body、Method），一键还原请求现场。
*   **📑 多标签页管理**：支持同时管理多个接口请求，左侧列表快速切换，自动保存上下文。
*   **💾 自动持久化**：基于 `LocalStorage` 自动保存所有请求数据和界面状态，刷新页面不丢失，下次打开自动恢复。
*   **🌗 日夜模式**：内置经典明亮模式与 VS Code 风格的暗黑模式，一键切换。
*   **👀 实时双向绑定**：URL 输入框与 Query 参数表格实时同步，修改一处，自动更新另一处。
*   **📝 JSON 语法高亮**：响应结果自动格式化并进行彩色高亮渲染，提升阅读体验。
*   **🔍 报文级调试**：底部提供可拖拽的调试面板，展示实际发送的 HTTP 请求报文和原始响应报文。
*   **⚡ 快捷键支持**：
    *   `Ctrl + Enter`：发送请求
    *   `Ctrl + S`：保存当前请求

## 🛠️ 安装说明

由于这是一个开发者工具，目前建议通过“加载已解压的扩展程序”方式安装：

1.  **克隆或下载本项目**到本地：
    ```bash
    git clone https://github.com/your-username/litefox.git
    ```
2.  打开 Chrome 浏览器，在地址栏输入：`chrome://extensions/`
3.  在右上角开启 **“开发者模式” (Developer mode)** 开关。
4.  点击左上角的 **“加载已解压的扩展程序” (Load unpacked)** 按钮。
5.  选择本项目所在的文件夹（即包含 `manifest.json` 的目录）。
6.  安装完成！点击浏览器右上角的 LiteFox 图标即可开始使用。

## 🖥️ 目录结构

```text
litefox/
├── manifest.json   # Chrome 扩展的核心配置文件 (Manifest V3)
├── background.js   # 后台服务脚本，负责打开独立标签页
├── index.html      # 主界面 HTML 结构
├── style.css       # 样式文件 (包含日夜模式 CSS 变量)
├── main.js         # 核心逻辑 (请求发送、cURL解析、数据持久化等)
└── icon.png        # 插件图标
