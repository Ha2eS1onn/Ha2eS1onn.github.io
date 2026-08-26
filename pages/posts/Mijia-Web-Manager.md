---
title: 米家设备管理 (Mijia Web Manager)
comments: true
date: 2026-08-25
tags:
  - Vue
  - Python
  - 前端
  - vibe coding
categories:
  - 开发
---

# 米家设备管理
> [Mijia Web Manager](https://github.com/Ha2eS1onn/mijia-web-manager "开源地址")

该说不说科技改变生活（AI太好用了你知道吗）。  
起因还是玩一个安卓的AI Agent——[Operit AI](https://operit.app/ "官网")的时候突然想到：**能不能让Agent帮我操作智能家居呢**。然后去搜了下有没有逆向的米家控制api，结果找了下还真有一个python库([mijia-api](https://github.com/Do1e/mijia-ap))。再用deepseek v4（pro和flash）+[cline](https://cline.net.cn/ "官网")写了这个web端的家居控制。这个项目只是熟悉[mijia-api](https://github.com/Do1e/mijia-ap)用的，后续可能会搞一搞AI Agent方面的(?

具体的技术栈我其实不是很懂，只知道是一个web前端和一个python后端，因为这个api不支持http请求所以要有个后端，倒是后来找了找还有一个项目([mijia-control](https://github.com/handsomejustin/mijia-control))是支持http请求的，只不过我懒得折腾了。

## 项目介绍
> 这一块就交给AI来吧

项目介绍：米家设备管理 (Mijia Web Manager)

### 项目概览

米家设备管理是一个类米家APP的渐进式Web应用（PWA），旨在提供轻量级、跨平台的智能家居管理方案。项目采用前后端分离架构，核心设计理念是本地优先与隐私安全。所有用户敏感凭证仅保存在用户自托管的服务器端，前端仅存储非敏感登录标记，以此降低数据泄露风险。

### 核心功能

该工具实现了米家APP的主要管理功能，并增加了独特的用电分析能力，具体功能模块如下：

| 功能模块 | 具体特性 |
| --- | --- |
| 安全认证 | 支持米家APP扫码登录、Token自动刷新，凭证在服务器端加密存储。 |
| 设备管理 | 提供列表展示、分类筛选、关键词搜索、设备收藏、重命名与删除操作。 |
| 智能控制 | 根据设备规格动态渲染控制面板，自动生成开关、滑块、按钮组、颜色选择器等控件。 |
| 场景执行 | 支持一键执行预设的手动场景。 |
| 用电分析 | 集成ECharts图表库，展示用电趋势、能耗占比及电费统计，支持日、周、月、年视图切换。 |
| 电价计算 | 内置固定电价、阶梯电价、峰谷电价三种计算模型，可自动重算历史电费。 |
| 离线体验 | 通过IndexedDB（Dexie）缓存设备数据，实现离线秒开，并支持安装为桌面应用。 |

### 技术架构

项目采用现代前后端分离架构，数据流清晰明确。

- 前端：基于Vue 3 + TypeScript + Vite + Tailwind CSS 4 + Pinia + Dexie + ECharts构建，通过vite-plugin-pwa实现PWA支持。
- 后端：使用Python + FastAPI框架，封装mijia-api与小米官方API（api.mijia.tech / account.xiaomi.com）交互。
- 部署方式：前端可部署于Vercel或GitHub Pages等静态托管平台，后端推荐自托管于Railway等平台，并可通过Vercel Rewrites或Cloudflare Worker配置反向代理以解决跨域问题。

### 快速开始

#### 环境要求

- Node.js 20或更高版本
- Python 3.10或更高版本

#### 启动步骤

1. 启动后端服务：
   <pre><code class="language-bash">
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   </code></pre>

2. 启动前端开发服务：
   <pre><code class="language-bash">
   npm install
   npm run dev
   </code></pre>
   
   启动成功后，访问 <http://localhost:5173> ，使用米家APP扫码登录即可。Windows用户也可直接运行 `start-dev.bat` 或 `start-dev.ps1` 脚本实现一键启停。

#### 关键配置项

| 环境变量名 | 所属端 | 作用说明 |
| --- | --- | --- |
| VITE_API_BASE_URL | 前端 | 指定后端API地址，默认为/api（开发环境下Vite会自动代理到8000端口）。 |
| VITE_API_KEY | 前端 | （可选）与后端约定一致的共享密钥，设置后会在请求头中注入X-API-Key。 |
| AUTH_PATH | 后端 | 认证文件存储路径，默认为auth.json。 |
| FRONTEND_ORIGIN | 后端 | 配置CORS允许的前端域名，多个域名用逗号分隔。 |
| API_KEY | 后端 | （可选）启用后，会要求客户端请求头必须包含匹配的X-API-Key。 |

### 用电统计特别说明

- 统计接口仅部分设备支持（如空调伴侣等具备电量监测功能的设备）。
- 统计数据的字段Key因设备型号而异，用户需在设备详情页的“更多”菜单中手动配置正确的Key（例如powerCost或7.1）。
- 后端会自动尝试回退常见Key，并兼容_v3与非_v3的数据类型，同时自动将瓦时（Wh）统一换算为千瓦时（kWh）。
- 若某设备不支持统计，同步数据时会自动跳过该设备，不会影响其他设备的数据同步。

### 许可证与免责声明

- 本项目采用GPL-3.0开源协议，基于同样采用GPL-3.0协议的mijia-api构建。
- 重要声明：
  - 本项目仅供学习交流使用，严禁用于商业用途。
  - 本项目非小米官方产品，与小米公司无关。
  - 用户使用本项目所产生的任何后果，需自行承担风险。

### 项目资源

- 源代码仓库：<https://github.com/Ha2eS1onn/mijia-web-manager>
- 后端自托管（如Railway）的详细部署指引，请参阅项目内 backend/README 文件。