# 官网开发、验证与部署

版本：1.0 · 2026-10-21（北京时间）

## 1. 工程结构

官网采用零第三方依赖的静态多页 HTML、CSS 和 JavaScript。浏览器执行原生 ES Modules；构建程序仅使用 Node.js 标准库。

| 路径 | 职责 |
| --- | --- |
| `web/layout.html` | 公共 HTML 外壳、导航、页脚、页面元信息和内容安全策略。 |
| `web/pages/*.html` | 8 个页面的主体文案与语义结构。 |
| `web/assets/site.css` | 设计变量、组件、页面布局、响应式与减少动效样式。 |
| `web/assets/site.js` | 导航、动效、图表、场景切换、3D 接线、流程、测算与本地文件导出。 |
| `web/assets/models.js` | 固定场景数据、纯函数收益模型与浏览器本地流程状态转换。 |
| `web/assets/station-scene.js` | 原生 Canvas 场站模型、投影绘制、设备选择和视角交互。 |
| `web/favicon.svg` | 网站图标。 |
| `scripts/build.mjs` | 组装页面、生成带哈希文件名的资源、重写资源引用、生成站点地图与构建版本。 |
| `scripts/check.mjs` | 语法、完整构建、HTML 本地引用、锚点、ARIA、元信息、模块与发布目录检查。 |
| `scripts/dev.mjs` | 本地静态开发服务器；监听 `web` 变化并重新构建。 |
| `tests/models.test.mjs` | 7 项收益计算、人工确认、复测重开、状态隔离与场景数据测试。 |
| `dist/` | 自动生成的部署目录；不要直接修改。 |

根目录 `docs/01-PRD.md` 至 `docs/12-RELEASE-CHECKLIST.md` 仍是工业产品规划与验收基线。官网建设不改变这些工作的完成状态，也不代表 Go 服务、设备协议、数据库、Saker 持久化任务或服务端安全门已经实现。

## 2. 本地运行

推荐 Node.js 24，与计划中的 Render 构建环境保持一致。当前没有第三方 npm 依赖，无须安装前端框架或打包器。

```sh
node --version
npm run check
npm test
npm run dev
```

默认入口为 `http://localhost:4173/`。如端口已被使用，可设置 `PORT`，例如：

```sh
PORT=4180 npm run dev
```

修改 `web` 下的文件会触发重新构建；刷新浏览器即可查看。开发服务器中的 `/__qa__/viewport?width=390&page=experience.html` 可将页面放入指定宽度的 iframe，辅助观察窄屏布局。它仅供开发检查，不会进入 `dist`，也不能替代真实触屏设备测试。

## 3. 修改文案与页面

直接修改对应的 `web/pages/*.html`。所有页面的标题和 description 在 `scripts/build.mjs` 的 `pages` 数组中维护；公共导航、页脚和 CSP 在 `web/layout.html` 中维护。

新增内容时保留现有标题层级、按钮语义与可访问名称。页面内跳转使用真实存在的 ID；跨页跳转采用 `/platform.html#observe` 这类明确路径。网站是多页静态站，不依赖 SPA 路由重写。

模板使用 `{{title}}`、`{{description}}`、`{{page}}`、`{{content}}`、`{{canonical}}` 和 `{{nav}}`。资源引用写源文件名，例如 `/assets/site.css`；构建器会改写为带内容哈希的文件名。不要手动复制生成的哈希名称回源文件。

与真实产品有关的声明应核对[内容范围](CONTENT-AND-SCOPE.md)和原始规划文档。不得把目标精度、实验设想、拟支持的协议或尚未接入的品牌写成既有成果。固定脚本仿真标记应放在数据附近。

## 4. 修改场景与本地工单

### 场景数据

`web/assets/models.js` 的 `SCENARIOS` 当前包含 `normal`、`charger`、`battery`、`grid`。每组提供主指标、单位、基线、12 点趋势、辅助趋势、三条证据、三个候选原因、支持/反对信息和人工待核验项。

修改数值时同时检查首页、场景页、应用场景静态插图与导出内容是否仍一致。保持单位与额定量含义明确：参考场站为 **12 个 120 kW 终端、1 MWh 储能、500 kW PCS**。棚顶光伏是造型概念，不代表新增已定义的光伏容量。

`secondarySeries` 是场景模型数据；目前界面主趋势图绘制 `series`，其他证据通过文本面板呈现。不要仅修改辅助数组，就声称页面新增了一张辅助测点曲线。

### 流程状态

`createWorkflow()` 创建当前场景的本地流程；`advanceWorkflow()` 返回新的状态与历史，不修改传入状态。`WORKFLOW_STEPS` 定义观察、关联、候选、人工、复测、归档六个阶段。页面行为和按钮由 `site.js` 连接。

当前本地状态包括 `NEW`、`CORRELATED`、`CANDIDATES_READY`、`AWAITING_HUMAN`、`RETEST_PENDING`、`REOPENED` 和 `ARCHIVED`。这些是展示状态，**不能直接替代**[工业 API 草案](../04-AGENT-API.md)和[产品业务状态](../01-PRD.md)。接入真实服务时应单独定义映射、权限、审批、幂等与服务端校验。

人工反馈只能在人工阶段确认；提前传入确认不会预先放行。复测失败会重开证据整理，并清除上轮人工确认。当前浏览器内的门控只演示协作顺序，不能证明后端权限隔离或工业安全测试通过。

页面不请求设备 API、不调用模型服务、不创建生产工单、不使用浏览器持久化存储。切换场景或刷新会重置进度；下载 JSON 是访问者主动导出的本地记录。

## 5. 修改 3D 场站

`station-scene.js` 使用三维坐标、投影、深度排序和原生 Canvas 2D 绘制场站。它具有空间旋转、缩放与设备交互效果，**不是 WebGL 或 Three.js 渲染器**，也没有加载外部模型、贴图或 CDN。

入口为 `createStationScene(canvas, options)`，返回以下方法：

| 方法 | 用途 |
| --- | --- |
| `setScenario(id)` | 设置 normal / charger / battery / grid 高亮状态。 |
| `setFocus(id)` | 聚焦 all / charging / storage / grid。 |
| `setView(id)` | 切换 iso / top / front。 |
| `reset()` | 还原视角与缩放。 |
| `zoom(delta)` | 在受限范围内调整缩放。 |
| `setAutoRotate(boolean)` | 设置自动旋转。 |
| `destroy()` | 释放观察器、事件与动画资源。 |

设备选择通过 `options.onSelect` 回调通知页面。修改几何、颜色或相机后，应检查首页与演示页两种画布尺寸；页面 CSS 与投影空间共同影响裁切和留白。

保留减少动态效果支持、页面隐藏与视口外暂停、像素比例限制、触摸纵向滚动与 Canvas 不可用时的替代内容。键盘方向键、加减键和 `R` 由场景模块处理；页面按钮也提供视角操作入口。

## 6. 收益与试点需求

收益模型遵循[既有年度公式](../10-PILOT-ROI.md)：

```text
毛收益 = 场站数 × 每站年有效事件数 × 有效改善比例
       ×（每次节省诊断工时 × 工时成本 + 每次减少停机 × 停机损失率）
净收益 = 毛收益 − 年度总投入
ROI = 净收益 ÷ 年度总投入
```

`calculateROI()` 要求输入为有限非负数，场站数至少为 1，有效改善比例在 0–1 之间；页面百分数在计算前转换为比例。年度投入为零时 `roi` 返回 `null`。净收益保留负值；无效输入应清空旧结果并禁止下载旧测算。

站点数在页面上采用整数步长；修改模型或其他调用入口时，应继续明确站点数的整数约束。人工与停机价值分项显示，防止重复计价。

需求表单只生成文本摘要。修改表单字段时同步更新摘要、输入长度限制和隐私说明。不要把“生成清单”改成“已提交申请”，除非已经实施并验证真实收件后端。文本输出通过 `textContent` 等安全方式呈现，不把访问者输入当作 HTML 执行。

## 7. 检查与修复

发布前执行：

```sh
npm run check && npm test
```

### 构建检查

`npm run check` 先检查 `scripts` 与 `web/assets` 的 JavaScript 语法，再生成实际 `dist`，核对：

- 8 个页面完整、标题与描述非空，无未替换模板标记。
- 本地链接和资源存在，同页/跨页锚点可找到。
- 页面 ID 不重复，`aria-controls` 指向有效目标。
- 构建后的 ES Modules 相对导入指向存在的资源。
- 发布目录不包含内部 `docs`、`data`、源码或测试等内容。

错误会列出具体文件和引用，并使命令以非零状态结束。修复源文件后重新运行，勿直接改 `dist` 掩盖问题。

### 7 项模型测试

`npm test` 使用 Node 内置测试运行器，覆盖：

1. 年度 ROI 公式和收益分项。
2. 负净收益和零投入。
3. 无效、不完整、非数字和溢出输入。
4. 人工阶段不能提前确认或直接跳过。
5. 复测失败重开后需要新的人工确认。
6. 场景重置和历史状态隔离。
7. 12 点场景数据、基线与证据完整性。

这些测试验证官网的纯函数逻辑，不验证工业平台、设备通信、持久化恢复或生产级安全策略。

### 浏览器检查

检查真实页面的布局与操作：导航、三维拖动/按钮、三类场景、人工确认、复测失败重开、下载、测算和表单生成。至少观察桌面与窄屏布局，并检查键盘焦点、减少动效和控制台错误。只将实际执行过的检查记录为通过；iframe 窄屏预览不等同真实手机测试。

## 8. Render 部署配置

以下是本次计划使用的配置；部署终态由发布负责人记录，本文不声明服务已上线。

| 设置 | 值 |
| --- | --- |
| 服务类型 | Static Site |
| 服务名 | `saker-energy` |
| Git 仓库 | `https://github.com/saker-ai/saker-energy` |
| 分支 | `main` |
| 构建命令 | `npm run check && npm test` |
| 发布目录 | `dist` |
| Node 环境 | `NODE_VERSION=24` |
| 跳过自动安装 | `SKIP_INSTALL_DEPS=true` |
| 网站地址变量 | `SITE_URL=https://saker-energy.onrender.com` |
| 目标地址 | `https://saker-energy.onrender.com` |

`SITE_URL` 控制 canonical、Open Graph URL、robots 和 sitemap。更换正式域名时，应同步修改该值并重新构建。不要把仓库根目录或 `web` 目录作为发布目录。

`build.mjs` 会生成 `version.json`；Render 环境下优先写入 `RENDER_GIT_COMMIT`，本地构建为 `local`。部署后应核对远端版本、对应提交、页面资源和核心交互。一次部署触发成功不等于上线成功，应等待特定部署成为 `live`，再完成公开访问检查。

首次部署与后续发布均应在单独 `RELEASE.md` 记录服务/部署标识、提交 SHA、执行命令、检查结果、实际 URL、时间和剩余限制。不要在文档、日志或源码中记录访问凭证。

## 9. 回滚与后续维护

代码回滚使用新的 Git revert 提交，保留历史，不使用强制推送。先同步最新 `main` 并确认要撤销的提交：

```sh
git switch main
git pull --ff-only
git log --oneline -n 10
git revert <要撤销的提交SHA>
npm run check && npm test
git push origin main
```

如项目要求 PR，先建修复分支，提交 revert 后通过既有 PR 流程合入 `main`。涉及合并提交时应先核对父提交，不能机械选择 mainline。遇到冲突，逐项处理并重新验证，不覆盖他人的并行修改。

Render 是否自动部署取决于服务当前设置。推送回滚后，核对是否产生对应部署；若需手动部署，部署最新已验证提交。等待终态并再次确认 `version.json` 与页面行为。回滚前后的提交与部署均追加记录在发布文档中。

本网站没有持久化业务数据库，但已经下载到访问者设备的需求或仿真文件不会被代码回滚撤回。未来接入后端、用户数据或设备时，需要另行设计发布兼容性、数据迁移和工业安全验收，不能沿用静态站检查替代这些要求。
