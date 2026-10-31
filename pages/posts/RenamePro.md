---
title: RenamePro
comments: true
date: 2026-10-01
updated: 2026-10-31
tags:
  - Windows
  - C#
  - .NET 8
  - vibe coding
categories:
  - 开发
---
# RenamePro

在资源管理器里改文件后缀（例如 `a.jpg` 改成 `a.png`），程序在后台自动把文件内容真正转换成新格式的 Windows 托盘工具。

它不新增右键菜单、不弹自定义主窗口、不出现控制台窗口：双击运行后只是一个托盘图标，之后完全跟随你在资源管理器里的改名动作工作。

v2.0 把这套动作扩展到了文档：把 `report.docx` 改成 `report.pdf`、`slides.pptx` 改成 `slides.pdf`，同样会真的执行转换，而不是留下一个"名字是 PDF、内容其实是 DOCX"的坏文件。

## 一、项目简介

Windows 只改文件后缀并不会改变文件内容，改完常常得到一个"名字是 PNG、内容其实是 JPEG"的坏文件（图片打不开、播放器报错）。RenamePro 监听系统里的文件改名事件，识别出"后缀变了且新旧格式属于同一媒体类别"的情况后自动完成三件事：

1. 先把改名后的文件原样复制为原格式副本（`a - 副本.jpg`），保证可回退；
2. 再把文件内容转换为新格式，写入同目录临时文件后原子替换；
3. 转换过程通过系统资源管理器同款的进度对话框展示，可取消。

图片、音视频、文档三条转换管线共用这一套"监听 → 判定 → 备份 → 临时文件 → 原子替换"的骨架，区别只在于中间由谁负责真正的格式转换：Magick.NET、FFmpeg 还是文档引擎。

### v2.0.0 更新摘要

v2.0.0 已完成开发并发布（2026-10-01），主要变化如下：

- **新增文档转换**：把 `report.docx` 改成 `report.pdf`、`slides.pptx` 改成 `slides.pdf`、`notes.md` 改成 `notes.docx` 都会真正转换（Office / ODF / Markdown / HTML / CSV ↔ PDF、同族互转），由无头 LibreOffice 或 Office COM 执行，带 magic 校验、跨族拒绝、超时与逐级降级；
- **发布形态改为三个包**：图片版、音视频版仍是单文件 exe；新增**全功能版**＝`RenamePro.exe` + `LibreOffice\` 目录包，文档转换开箱即用、且没有"首次解压几百 MB"这一步；
- **文档引擎不再嵌入 exe**：全功能版 exe 从 338.8 MB 降到 83.2 MB，磁盘占用从约 1.06 GB 降到约 786 MB（取舍对比见「文档引擎为什么是"目录"而不是"内置载荷"」）；
- **新增排障入口**：`RenamePro.exe --selftest`（内置自检，退出码即结论，结果同时写 `selftest-report.txt`）与 `RenamePro.exe --docdiagnose <文件> [目标后缀]`（真实跑一次转换，打印引擎来源、magic 嗅探与矩阵判定）；
- **新增引擎构建与校验脚本**：`setup-lo-dev.ps1`（展开官方 MSI）、`build-docengine.ps1`（裁剪成随包目录）、`verify-docengine.ps1`（`-Soffice` / `-EngineDir` / `-Package` 三种端到端校验），测试方法见 [docs/测试方法.md](https://github.com/Ha2eS1onn/RenamePro/blob/main/docs/测试方法.md)。

## 二、核心特性

### 监听与判定

- 监听**所有固定磁盘**（可在 `watchDrives` 中限定盘符），`IncludeSubdirectories` 递归整个磁盘；
- 性能优先：`NotifyFilter` 只设 `FileName`（改名事件只依赖文件名通知），缓冲区 256KB；
- 监听器出错时按 `1s / 5s / 30s` 指数退避自动重建，并在日志中记录缓冲区溢出丢失的时间窗口；
- 四级早退判定（按开销升序）：内部操作抑制表 → 扩展名白名单（图片 / 音视频 / 文档三类）→ 排除目录 → 排除文件名模式；
- 排除 `C:\Windows`、`C:\Program Files`、`C:\Program Files (x86)`、`$Recycle.Bin`、`System Volume Information`，以及 `~$` 开头（Office 临时文件）与 `.` 开头的文件；
- 300ms 防抖合并：连续多次改名只处理最后一次，规避资源管理器改名瞬间的句柄占用；
- 防重入：同一路径处理期间重复触发直接跳过；
- 转换前读取文件头 magic number 校验真实格式与源扩展名是否一致，不一致直接跳过并记录原因。

### 图片转换（Magick.NET）

- `png / jpg / jpeg / bmp / gif / webp / tiff` 之间互转；
- 仅 JPEG 输出有损（质量由 `imageQuality` 配置，默认 92），其余输出无损（WebP 走无损编码）；
- GIF 源按 `gifPolicy` 处理：`first-frame` 取首帧，`skip` 直接忽略；
- 涉及 `.ico` 的组合不做转换（静默跳过），避免产生不稳定的图标文件。

### 音视频转换（FFmpeg 子进程）

- **流拷贝优先**：先用 `ffprobe` 探测流编码，若编码属于 `h264 / hevc / aac / ac3 / opus / vorbis / mp3` 且目标容器能容纳，则执行 `-c copy` 仅重封装——快慢与文件大小几乎无关，通常秒级完成；
- 流不兼容或编码不在白名单时自动重编码（视频 `libx264 -crf 23 -preset veryfast` + `aac`；WebM 目标自动改用 `libvpx-vp9 + libopus`，WMV 目标改用 `wmv2 + wmav2`）；
- 音频互转按目标格式选编码器：mp3 用 `libmp3lame -q:a 2`、aac/m4a 用 `aac -b:a 128k`、ogg 用 `libvorbis`、flac 用 `flac`、wav 用 `pcm_s16le`；"有损转无损"不阻断，但会在日志提示不会提升音质；
- 跨类别转换：视频转音频 = 提取音轨；音频转视频 = 仅音频流封装（可 copy 则 copy）；
- 通过 `-progress pipe:1` 解析 `out_time` 与总时长换算进度百分比，`stderr` 全量捕获用于错误详情；
- `ffmpeg.exe` 缺失时**仅禁用音视频功能**，图片转换完全不受影响，日志明确提示。

### 文档转换（随包 LibreOffice / 系统 LibreOffice / Office COM）

- 复用同一套改名驱动流程：把 `report.docx` 改成 `report.pdf`、`slides.pptx` 改成 `slides.pdf`、`notes.md` 改成 `notes.docx` 会真正执行转换，而不是直接跳过；
- 文档转换受 `documentConversion` 总开关控制（默认 `true`）；设为 `false` 时文档改名只记日志跳过，且完全不探测引擎；
- 进入文档管线的扩展名：`.docx .docm .dotx .doc .odt .ott .rtf .md .markdown .html .htm .xhtml .pptx .pptm .potx .ppt .odp .otp .xlsx .xlsm .xltx .xls .ods .ots .csv .tsv`（`.pdf` 仅在 `allowPdfSource` 为 `true` 时作为源）。刻意**不含 `.txt`**：把 txt 改名成别的是高频误操作，而纯文本没有 magic 可校验，收录它只会让"无法确认内容"的文件进管线；
- 按族转换（完整矩阵见"八、支持的格式矩阵"）：Writer 族出 `docx / doc / odt / ott / rtf / md / markdown / html / htm / xhtml / pdf`，Impress 族出 `pptx / ppt / odp / otp / pdf`，Calc 族出 `xlsx / xls / ods / ots / csv / tsv / pdf`；跨族转换只允许目标为 `pdf`，其余跨族组合按设计拒绝并写明原因（`docx → xlsx` 记一行 SKIPPED，原因指出表格只能用 csv / pdf 这两种出口）；
- 启用宏的输入（`.docm` / `.xlsm` / `.pptm`）可以作为源，但永远不会被生成——程序不产出带宏的文档；
- PDF 作源默认关闭（`allowPdfSource: false`）：PDF 导入只能保证文字内容，列结构、浮动对象与表格边界都会丢失，所以默认不让它进管线；
- `md → docx` 由**内置转换器**完成，不需要任何外部引擎，支持标题、粗体/斜体、行内代码、围栏代码块、链接、图片、引用、有序与无序列表、表格、水平线与段落分隔；丢失是明确的：不带 Word 样式与主题、不解析引用式链接、不支持脚注、不保证嵌套列表的缩进。Markdown 输出（如 `docx → md`）走外部引擎，只保留基本结构，属于"类 Markdown"；
- 引擎路由由 `documentEngine` 选择，共三种引擎：`auto`（默认）依次尝试**程序目录里的随包引擎目录 `LibreOffice\`** → 系统安装的 LibreOffice（无头 `soffice`）→ Microsoft Office COM（Word / PowerPoint / Excel）；`libreoffice` / `bundled` / `com` 各自只允许其中一种（`bundled` = 只用随包目录）。全功能版自带 `LibreOffice\`，因此开箱即用；环境变量 `RENAMEPRO_SOFFICE` 可指定任意一份 soffice（测试与便携部署用，优先级最高，`documentEngine` 为 `com` 时除外），`RENAMEPRO_DOCENGINE` 可把随包引擎目录指到别处；
- LibreOffice 一律无头启动，并使用私有的每进程 profile（`-env:UserInstallation=file:///...`）。**为什么必须私有 profile**：不指定时第二个 `soffice` 会把任务交给已在运行的实例再立刻以 0 退出，真正的转换还在后台跑——这是一次假成功；两个进程共用一个 profile 还可能把它写坏；
- 文档走独立的串行调度车道（`docMaxConcurrency`，默认 1），保证同时只有一个文档引擎在跑；
- 引擎一个都没有时，行为与 ffmpeg 缺失完全一致：只禁用文档转换，`log.txt` 写一段带具体原因的警告，之后每次文档改名记一行 SKIPPED，图片与音视频完全不受影响；内置的 `md → docx` 不需要任何引擎，在其它引擎全部不可用时照样可用；
- 转换前按 magic number 校验真实格式，与图片 / 音视频同款：内容其实是 PNG 的 `.docx` 会被跳过，绝不转换。OOXML 全是 ZIP 容器，靠条目清单区分：出现 `word/` 前缀的条目即 Word、`ppt/` 即 PowerPoint、`xl/` 即 Excel（ZIP 的条目名在文件末尾的中央目录里，因此这一判定是读条目清单而不是猜文件头）；ODF（odt / ods / odp）看存储的 `mimetype` 条目内容；老格式 `.doc` / `.xls` / `.ppt` 看 OLE2 签名加根目录条目名；RTF 看 `{\rtf`；PDF 看 `%PDF-`；
- 纯文本源（`.md` / `.markdown` / `.csv` / `.tsv` / `.html` / `.htm` / `.xhtml`，不含 `.txt`）不可能有 magic number，因此走刻意保守的路径：只有当文件字节与任何已知二进制格式都不匹配时才接受（HTML 还要求带 HTML 标记），任何可识别的二进制签名都拒绝。校验失败一律 fail closed——无法确认的文件只跳过，不转换。

### 备份与失败处理

- 转换前生成原格式副本，命名跟随系统 UI 语言：中文系统 `a - 副本.jpg`，英文系统 `a - copy.jpg`；同名冲突自动递增为 `a - 副本 (2).jpg`；
- 副本与目标同目录，**程序永不自动删除副本**；
- 特殊文件跳过：EFS 加密文件、云盘按需占位文件（`skipCloudFiles`）；只读文件在替换前临时清除只读位、替换完成后恢复；
- 文件占用（IOException）按 500ms 间隔重试最多 3 次，仍失败则任务失败且不留半成品（临时文件清理、目标文件保持原状）；
- 默认保守策略：失败只记录日志不回滚；开启 `autoRollbackOnFailure` 后，失败会删除目标文件并把副本移回原名——移动前登记内部操作抑制表，确保恢复后的文件不会被再次转换；
- 文档任务同样走这套备份与失败处理：引擎失败、超时或取消时，目标文件保持原状，原格式副本保留；文档引擎的临时工作目录（`.renamepro-doc-*`）在任务结束时清理，进程崩溃留下的残留目录会在下次任务前被清扫。

### 进度与通知

- 进度对话框直接封装系统 Shell COM 接口 `IOperationsProgressDialog`，外观与资源管理器传输框一致；
- Shell COM 要求 STA 与消息循环，因此程序维护一个**专用 STA 消息线程**，对话框的创建、进度更新、销毁全部通过 `Invoke / BeginInvoke` 封送到该线程执行；
- 多任务聚合显示：同一批次共用一个对话框，按已完成任务数与当前任务内进度合成总进度；未知总量（流拷贝没有总时长）自动切换为滚动条模式；
- 小于 400ms 的快速任务不弹进度框（防闪烁），静默完成；
- 取消：在进度框点"取消"会取消整个队列，正在运行的 FFmpeg 进程树被终止、副本保留、目标文件不被破坏；文档转换取消时同样杀掉整个 LibreOffice 进程树（只杀启动器会留下持有 profile 锁的 `soffice.bin`）；
- 任务全部完成后可弹 Windows Toast 汇总（`enableToast`），失败任务带"失败"前缀行；Toast 不可用时自动回退为托盘图标闪烁；
- 任何 Shell COM 失败都会**整体降级**为静默转换 + 完成 Toast，并在日志记录，绝不会因为界面组件异常而影响转换本身。

### 可靠性与资源占用

- 单实例：命名互斥体保证只运行一个实例，重复双击只提示不新开；
- 托盘图标在 Explorer 重启或登录早期通知区未就绪时自动重建；
- 开机自启通过任务计划程序注册（登录时运行），任务指向的 exe 路径过期时自动纠正；
- Magick.NET 延迟加载：只有真正执行图片转换时才加载 Magick 程序集与原生库，启动时不触碰；
- Magick 内存上限 512MB，防止超大图片拖垮系统；
- 文档引擎探测结果缓存在进程内，配置重新加载时失效；探测只跑 `soffice --version`，**绝不为了探测去遍历几千条引擎文件**或启动 Word/Excel；
- 启动时可在后台预热一次文档引擎（`docWarmupOnStart`），把 LibreOffice 首次创建用户配置目录的开销挪到用户第一次转换之前；预热失败只记日志，不影响功能；
- 实测空载工作集约 57MB、私有内存约 12MB（未加载 Magick 时）。

### 便携与配置

- 绿色免安装：解压后双击 `RenamePro.exe` 即用；配置与日志都在程序同级目录；
- 图片版与音视频版解压后只有一个 exe；全功能版是目录包，`RenamePro.exe` 必须与同级 `LibreOffice\` 待在一起；
- `config.json` 首次运行自动生成，带中文注释，可用记事本直接修改，托盘菜单"重新加载配置"即时生效（个别项需重启）。

## 三、技术栈

| 分类 | 选型与说明 |
| --- | --- |
| 语言 / 运行时 | C# 12 / .NET 8，目标框架 `net8.0-windows10.0.19041.0`（win-x64） |
| 界面 | WinForms，但只使用 `NotifyIcon` 托盘图标与 `ContextMenuStrip`，无主窗口、无控制台（`OutputType=WinExe`） |
| 图片转换 | Magick.NET-Q16-AnyCPU（**项目中唯一允许的第三方 NuGet 包**），配合 Magick 进度事件回报百分比 |
| 音视频转换 | FFmpeg：`ffmpeg.exe` 以子进程方式调用，`ffprobe.exe` 负责探测；进度用 `-progress pipe:1` 解析，错误取 `stderr` |
| 文档转换 | 三种引擎路由：程序目录里的随包引擎目录 `LibreOffice\`（全功能版自带，官方安装的裁剪树）、系统安装的 LibreOffice（无头 `soffice` + 私有 profile）、Microsoft Office COM（Word / PowerPoint / Excel）；另有一个不需要引擎的内置 Markdown → docx 转换器 |
| 文件监听 | `FileSystemWatcher`（仅 `FileName` 通知 + 256KB 缓冲），辅以自实现的 300ms 防抖调度器 |
| 系统集成 | Shell COM `IOperationsProgressDialog`（手写 Interop，含 `IShellItem`）、WinRT Toast（`Windows.UI.Notifications`）、任务计划程序（`schtasks`）、命名互斥体、Explorer 广播消息 `TaskbarCreated`、Shell 属性存储（写入 AUMID）、`CreateProcess` 风格的子进程调用 |
| 并发模型 | `Task` + `SemaphoreSlim` 分级队列、`CancellationTokenSource` 取消、专用 STA 消息线程封送、`ConcurrentDictionary` 防重入与抑制表；文档车道串行、Office COM 在独立 STA 线程上晚绑定 |
| 配置与日志 | `System.Text.Json`（允许注释与尾逗号的宽容解析）、线程安全追加式日志 |
| 打包 | 图片版 / 音视频版：单文件自包含发布（开启单文件内压缩、关闭 ReadyToRun、不使用 PublishTrim）；全功能版：单文件 exe + 同级 `LibreOffice\` 目录包；均为绿色 zip |

设计约束：不使用 `PublishTrim`（会破坏 COM Interop 与反射路径），不使用 `ReadyToRun`（体积翻倍），除 Magick.NET 之外不引入任何第三方包。文档引擎是随包分发的**外部程序**，不是 NuGet 依赖，也不参与编译。

### 发布体积构成（实测）

`RenamePro.csproj` 在发布期剔除 WPF / 设计器 / 调试符号程序集，`EnableCompressionInSingleFile` 对单文件包内做 deflate；FFmpeg 为项目自行精简编译并**内置进音视频版与全功能版的 exe**；文档引擎自 v2.0 起改为**随包目录**（见下）。

| 产物 | 体积 | 说明 |
| --- | --- | --- |
| `RenamePro.exe`（图片版） | 69.8 MB | 不嵌入 FFmpeg 载荷，音视频改名写日志跳过 |
| `RenamePro.exe`（音视频版 / 全功能版） | 83.2 MB | 含 13.4 MB 内置 FFmpeg 载荷；运行时、WinForms、Magick.NET 原生库全在其中 |
| `RenamePro-image-v2.0.0.zip` | 64.0 MB | **包内只有 `RenamePro.exe` + 使用说明**，仅图片转换 |
| `RenamePro-av-v2.0.0.zip` | 77.4 MB | 同样两个文件，图片 + 音视频（首次音视频转换解压一次内置 FFmpeg） |
| `RenamePro-full-v2.0.0.zip` | 328.7 MB | **目录包**：`RenamePro.exe` + `LibreOffice\` + 使用说明，包内 4549 个文件 / 787 MB；解压后约 790 MB |
| `ffmpeg\` 目录（本地构建源） | 34.4 MB | 2 个 exe + 10 个运行时 DLL；精简编译前是官方 essentials 构建，两个 exe 合计 201 MB |
| `libreoffice\` 目录（本地构建源，即包内 `LibreOffice\`） | 703 MB | 官方 LibreOffice 25.8.7 裁剪后 4547 个文件 / 4546 条清单；原始安装树 1502 MB / 19673 个文件 |
| 仓库源码 + 图标 | 约 350 KB | 二进制、DLL、引擎与打包产物均不入库 |

开启单文件压缩的代价是**首次启动**要把包内文件解压到 `%TEMP%\.net\RenamePro\<hash>\`（同一版本只解压一次，之后直接复用缓存）：实测冷启动约 1.3～1.9 秒，热启动约 30 毫秒。不想承担这个首启代价时，删掉 `RenamePro.csproj` 里的 `EnableCompressionInSingleFile` 即可回到未压缩单文件。

### 单文件是怎么做到的（FFmpeg 载荷）

图片版与音视频版解压后只有一个 `RenamePro.exe`。ffmpeg 并没有被编译进去，而是这样交付：

1. `publish.ps1` 把 `ffmpeg\` 下全部文件（2 个 exe + 10 个 DLL）压成**一个** `Assets\ffmpeg-payload.zip`（约 13.4 MB）；
2. 该 zip 以 `EmbeddedResource` 形式在**编译期**写进程序集（`EmbeddedResource` 由 C# 编译器处理，与单文件打包器无关，所以不需要 `ExcludeFromSingleFile`）；
3. 运行时由 [RuntimePayload.cs](https://github.com/Ha2eS1onn/RenamePro/blob/main/Conversion/RuntimePayload.cs) 在**首次需要音视频转换时**惰性解压到：
   ```
   %LOCALAPPDATA%\RenamePro\runtime\<载荷ID>\
   ```
   载荷 ID 是载荷字节的 SHA256 前 16 位，因此升级 FFmpeg 会自动换目录，旧目录随后被后台清理；
4. [AvConverter](https://github.com/Ha2eS1onn/RenamePro/blob/main/Conversion/AvConverter.cs) 从该目录调用 `ffmpeg.exe` / `ffprobe.exe`。

**为什么必须落盘**：Windows 加载器只按磁盘路径加载模块。`ffmpeg.exe` 是 `CreateProcess` 启动的子进程，它依赖的 10 个 DLL 要由加载器在 exe 同目录搜索，程序集里的嵌入资源对加载器不可见——"一个文件都不落盘"在 Windows 上做不到，能做到的是"用户只拿到一个文件"。

实测行为：

- 解压 34.4 MB 载荷耗时 **约 150 ms**（同一版本只解一次，之后每次启动直接复用）；
- 解压发生在**第一次音视频转换**时，不在启动路径上：只做图片转换的用户永远不会解压，托盘启动耗时与图片版一致；
- 首选目录不可写（受限环境）时自动退回 `%TEMP%\RenamePro\runtime\<载荷ID>\`；
- 两者都失败、或 DLL 被安全软件拦截时，音视频功能被禁用并把原因写进 `log.txt`，**图片转换不受影响**；
- 程序目录里放了 ffmpeg.exe / ffprobe.exe 时（开发期 `dotnet build` 的输出目录），直接用程序目录，不走解压。

> 三个版本必须分**多次独立发布**：FFmpeg 载荷在编译期嵌入，同一次发布的产物不可能既带又不带它。`publish.ps1 -Mode All` 已按这个顺序做（先出图片版，再出带载荷的音视频版与全功能版）。

### 文档引擎为什么是"目录"而不是"内置载荷"（v2.0 的取舍）

v1.1 的第一次尝试是把裁剪后的 LibreOffice 也压成 zip、编译期嵌进 exe，首次文档转换时解压到 `%LOCALAPPDATA%\RenamePro\runtime\doc-<载荷ID>\`。实测下来这个方案的代价明显大于收益，因此 v2.0 改成随包目录：

| | 内置载荷（v1.1） | 随包目录（v2.0） |
| --- | --- | --- |
| 全功能版 exe | 338.8 MB | 83.2 MB |
| 首次文档转换 | 先把 722 MB 解压到 `%LOCALAPPDATA%`（几十秒，且 C 盘要再占一份） | 直接就是现成目录，**没有解压这一步** |
| 磁盘占用 | exe 339 MB + 解压副本 722 MB ≈ 1.06 GB | exe 83 MB + 目录 703 MB ≈ 786 MB |
| 失败面 | 解压可能被杀软拦、被磁盘空间不足打断，失败即无文档功能 | 只有"目录被删／被复制走"这一种情况，日志会写明 |

现在的结构：发布包内 `RenamePro.exe` 旁边是 `LibreOffice\`（`program\` / `share\` / `Fonts\` / `licenses\` / `payload.json`），[DocumentEngine.cs](https://github.com/Ha2eS1onn/RenamePro/blob/main/Conversion/DocumentEngine.cs) 按 `RENAMEPRO_SOFFICE` → 随包目录（`RENAMEPRO_DOCENGINE` 可改）→ 系统安装 → Office COM 的顺序解析引擎，候选能否用**一律以 `soffice --version` 自检为准**（缺 DLL、被杀软隔离、目录只复制了一半，都在这里暴露，而不是等用户第一次转换）。详见 [build-docengine.ps1](https://github.com/Ha2eS1onn/RenamePro/blob/main/build-docengine.ps1) 与 [docs/测试方法.md](https://github.com/Ha2eS1onn/RenamePro/blob/main/docs/测试方法.md)。

用户侧只需要记住一条：**`RenamePro.exe` 要和同级 `LibreOffice\` 待在一起**；单独把 exe 复制走会退化为"只能用系统 LibreOffice / Office"。

### 精简版 FFmpeg（`build-ffmpeg.ps1`）

官方构建（gyan.dev essentials / full、BtbN）都带有本程序用不到的大量组件与全部硬件加速入口，两个 exe 解出来就是 201 MB，而本项目只用到：

- 编码器：`libx264` `aac` `libmp3lame` `libvorbis` `libopus` `libvpx-vp9` `flac` `pcm_s16le` `wmv2` `wmav2` `mpeg4`
- 容器：mp4/mov/m4a、mkv、webm、avi、wmv(asf)、flv、ts、ogg、mp3、wav、flac
- 探测：`ffprobe -show_entries stream=codec_type,codec_name / format=duration -of json`

所以 [build-ffmpeg.ps1](https://github.com/Ha2eS1onn/RenamePro/blob/main/build-ffmpeg.ps1) 用 `--disable-everything` 做白名单，只编这些；产物 **12.8 MB / 12.6 MB**，配套 10 个运行时 DLL。之所以要带 DLL，是因为 UCRT64 的 x264/lame/opus/vorbis/vpx/iconv/zlib 走的是导入库（`-Wl,-Bstatic` 在 FFmpeg 的链接行里控制不到这些位置），exe 旁边必须放齐，否则会静默失败（退出码 `0xC0000135`）。

改了白名单后**必须**跑校验脚本。它覆盖 81 项检查（55 项媒体能力与转换冒烟 + 26 项载荷一致性）：

```powershell
winget install --id MSYS2.MSYS2 -e            # 一次性：装 MSYS2
# 在 MSYS2 UCRT64 里装工具链（命令见 build-ffmpeg.ps1 报错提示）
powershell -ExecutionPolicy Bypass -File build-ffmpeg.ps1 -Proxy http://127.0.0.1:7897   # 20~40 分钟
powershell -ExecutionPolicy Bypass -File verify-ffmpeg.ps1            # 校验 ffmpeg\ 目录
powershell -ExecutionPolicy Bypass -File publish.ps1 -Mode Av         # 生成 FFmpeg 载荷并打包
powershell -ExecutionPolicy Bypass -File verify-ffmpeg.ps1 -FromPayload   # 校验会被嵌入的那份载荷
```

`-FromPayload` 会解包 `Assets\ffmpeg-payload.zip`，对它跑全部媒体检查，并核对载荷与 `ffmpeg\` 目录的文件清单和 SHA256 完全一致——这是防止"改了 ffmpeg\ 却忘了重新生成载荷"的关键一步。

升级 FFmpeg 版本只需改 `build-ffmpeg.ps1 -Version`，它会重新克隆对应标签并复用白名单；换版本后必须按上面的顺序重新校验并打包。

## 四、工作原理

```text
资源管理器改后缀
        │
        ▼
FileSystemWatcher.Renamed（全部固定磁盘监听，可用 watchDrives 限定；仅文件名通知）
        │
        ├─ 内部操作抑制表命中？ → 丢弃（本程序自身引起的变更）
        ├─ 扩展名白名单（新旧后缀归一化后不同，且同属图片 / 音视频 / 文档类别）
        ├─ 排除目录（系统目录、回收站、卷影副本）
        └─ 排除文件名（~$、. 开头）
        │
        ▼
300ms 防抖合并（同一路径只处理最后一次）
        │
        ▼
转换主流程：防重入 → 特殊文件检查 → magic number 校验 → 媒体探测（ffprobe）/ 文档矩阵判定
        │
        ├─ 快速通道（并发 2）：FFmpeg 流拷贝、小于 2MB 的图片
        ├─ 图片队列（并发 = imageConcurrency）：Magick.NET 位图转换
        ├─ 音视频队列（并发 1）：需要重编码的 FFmpeg 任务
        └─ 文档队列（并发 = docMaxConcurrency，默认 1）：LibreOffice 无头 / 内置引擎 / Office COM，同族或目标为 pdf
        │
        ├─ 无可用文档引擎？ → 只禁用文档转换（一次警告 + 每次改名一行 SKIPPED），图片与音视频不受影响
        │
        ▼
备份原格式副本 → 转换写入同目录临时文件 → 登记抑制表 → File.Replace 原子替换
        │
        ▼
结果写入 log.txt（OK / FAILED / CANCELLED / SKIPPED + 错误详情）
```

## 五、目录结构

```text
RenamePro/
├── Assets/                应用图标（同时作为 exe 图标与嵌入资源）
├── Core/                  配置、日志、路径判定、文件头嗅探、IO 重试、开机自启、单实例
│                          （文档排障：DocDiagnose.cs、内置自检 SelfTest.cs）
├── Watching/              FileSystemWatcher 监听封装、300ms 防抖调度
├── Conversion/            转换主流程、分级调度队列、备份管理器、图片转换器、音视频转换器、FFmpeg 载荷管理
│                          （文档转换：DocConverter.cs、DocumentEngine.cs、DocumentMatrix.cs、MarkdownToDocx.cs）
├── Interop/               Shell COM 进度对话框声明与包装、IShellItem / AUMID 辅助
├── Progress/              进度聚合器、专用 STA 消息线程、Toast 通知服务
├── Tray/                  托盘上下文、Shell 广播消息窗口（通知区重建）
├── ffmpeg/                ffmpeg.exe、ffprobe.exe 与 10 个运行时 DLL（构建源，未纳入版本库）
├── libreoffice/           随包引擎目录（build-docengine.ps1 的产物，未纳入版本库；发布时成为包内 LibreOffice\）
├── Assets/ffmpeg-payload.zip  上述 ffmpeg 文件压成的单个载荷（构建产物，不入库，编译期嵌入 exe）
├── app.manifest           Win10/11 兼容性声明与 DPI 设置
├── RenamePro.csproj       项目文件（体积优化目标、FFmpeg 载荷嵌入、开发期 ffmpeg/libreoffice 复制规则）
├── build-ffmpeg.ps1       精简版 FFmpeg 构建脚本（白名单 configure + 复制运行时 DLL）
├── verify-ffmpeg.ps1      FFmpeg 校验脚本（55 项能力与转换冒烟 + 26 项载荷一致性）
├── setup-lo-dev.ps1       文档引擎开发环境准备（下载官方 MSI → 解包，不安装、不注册 COM）
├── build-docengine.ps1    随包引擎构建脚本（裁剪 + 分类冒烟回滚 + 清单 payload.json）
├── verify-docengine.ps1   文档转换端到端校验（-Soffice 真实引擎 / -EngineDir 随包目录 / -Package 发布包）
├── test/stub-engine/      桩引擎（冒充 soffice 的测试替身，永不随产品发布）
├── docs/测试方法.md       文档转换的测试方法（自动 / 手工 / 自检三条路径）
└── publish.ps1            便携打包脚本（生成 FFmpeg 载荷、三版本发布、打 zip）
```

## 六、快速开始

### 方式一：使用发布包（推荐）

1. 到 Releases 页面下载（三个版本）：
   - `RenamePro-image-*.zip`：体积最小（约 64 MB），仅图片转换，音视频与文档改名会写日志跳过；
   - `RenamePro-av-*.zip`：图片 + 音视频，内置 FFmpeg（约 78 MB）；
   - `RenamePro-full-*.zip`：再加文档转换，**目录包**（`RenamePro.exe` + `LibreOffice\`，下载约 330 MB）；
2. 解压任意目录：图片版与音视频版**里面只有一个 `RenamePro.exe`**（外加使用说明）；全功能版是
   `RenamePro.exe` + `LibreOffice\` + 使用说明。双击 exe 即可——无窗口，托盘出现图标；
3. 在资源管理器里改文件后缀即可，例如 `photo.jpg` 改为 `photo.png`；
4. 托盘图标右键菜单：暂停监听 / 继续监听、开机自启动、重新加载配置、文档引擎状态、退出。

首次运行会在程序目录生成 `config.json`（带中文注释）与 `log.txt`。首次勾选"开机自启动"或程序自动注册自启动时会弹一次 UAC，允许即可。

音视频版与全功能版第一次做音视频转换时，会把内置的 FFmpeg 解压到 `%LOCALAPPDATA%\RenamePro\runtime\`（约 150 毫秒，只此一次），这是正常行为；只做图片转换不会触发。**文档引擎没有解压这一步**：全功能版的 `LibreOffice\` 就是现成目录，只要别单独把 exe 复制走即可。

### 方式二：从源码构建

```powershell
# 环境要求：.NET 8 SDK、Windows 10/11 x64
git clone https://github.com/Ha2eS1onn/RenamePro.git
cd RenamePro
# 音视频功能需要 ffmpeg：用 build-ffmpeg.ps1 自己编精简版（推荐），
# 或把任意 ffmpeg.exe / ffprobe.exe（含所需 DLL）放进 ffmpeg\ 目录
dotnet build RenamePro.csproj -c Debug
# 文档转换需要引擎（可选）：展开官方 LibreOffice，再裁剪成随包目录 libreoffice\
powershell -ExecutionPolicy Bypass -File setup-lo-dev.ps1
powershell -ExecutionPolicy Bypass -File build-docengine.ps1 -ReuseStage
```

### 打包便携发布包

```powershell
# 生成三个版本的 zip（默认输出到 dist\）
powershell -ExecutionPolicy Bypass -File publish.ps1 -Mode All -Version 2.0.0
# 只出某一个包
powershell -ExecutionPolicy Bypass -File publish.ps1 -Mode Image   # 图片版
powershell -ExecutionPolicy Bypass -File publish.ps1 -Mode Av      # 音视频版
powershell -ExecutionPolicy Bypass -File publish.ps1 -Mode Docs    # 全功能版（需要 libreoffice\）
```

`-Mode Docs` 找不到 `libreoffice\program\soffice.com` 时会自动调用 `build-docengine.ps1`；引擎树已经就绪时加 `-SkipEngineBuild` 直接打包。全功能版的 zip 用 7-Zip（存在时）压缩 700 MB 目录，通常需要几分钟。

> 这些脚本都以 UTF-8 保存；用 `powershell.exe`（Windows PowerShell 5.1）执行时请确认脚本按 UTF-8 解码，否则其中的中文注释会被当作 ANSI 而报语法错误（仓库内脚本已带 BOM，正常情况无此问题）。用 PowerShell 7 执行不受影响。

### 排障入口

v2.0 加了两个命令行入口，专门回答"到底哪里不对"：

```powershell
# 内置自检：格式嗅探、转换矩阵、内置 Markdown 转换器、随包引擎目录、端到端
RenamePro.exe --selftest
# 退出码 0 = 全绿；结果同时写进同目录的 selftest-report.txt
# 没有随包引擎目录时第 4 节是 [SKIP]，其余全绿同样算通过
# Debug 构建（bin\Debug\…）会自动带上 libreoffice\ → 第 4 节会实测随包引擎

# 文档转换诊断：真实跑一次转换，打印引擎来源、magic 嗅探与矩阵判定
RenamePro.exe --docdiagnose "D:\demo\报告.docx" .pdf
```

`--docdiagnose` 会输出三步：`[1/3]` 文件头嗅探与扩展名是否一致、`[2/3]` 转换矩阵判定、`[3/3]` 真实转换（引擎来源、profile 目录、耗时与产物路径）。它**不会改动源文件**，产出的诊断文件命名为 `<原名>.diag<后缀>`，用户把输出贴出来就能定位问题。

## 七、配置说明（config.json）

首次运行时自动生成在程序同级目录，带中文注释，可直接用记事本编辑；修改后点托盘菜单"重新加载配置"即时生效（`imageConcurrency` 在队列忙碌时下次启动生效）。

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `enableBackup` | `true` | 转换前是否创建原格式副本（`a - 副本.jpg`），建议保持开启 |
| `autoRollbackOnFailure` | `false` | 转换失败时是否自动回滚：删除目标文件并把副本移回原名 |
| `enableToast` | `true` | 全部任务完成后是否弹 Windows Toast 汇总通知 |
| `showProgressDialog` | `true` | 是否显示系统进度对话框；设为 `false` 时完全不初始化 Shell COM，静默转换 |
| `imageQuality` | `92` | JPEG 输出质量（1~100，仅对转出 jpg 生效） |
| `gifPolicy` | `"first-frame"` | GIF 源策略：`first-frame` 取首帧转换，`skip` 直接忽略 |
| `imageConcurrency` | `2` | 图片队列并发度（1~8） |
| `documentConversion` | `true` | 文档转换总开关；设为 `false` 时文档改名只记日志并跳过，且完全不探测引擎 |
| `documentEngine` | `"auto"` | 文档引擎路由：`auto`（随包目录 `LibreOffice\` → 系统 LibreOffice → Office COM）、`libreoffice`（只用系统安装）、`bundled`（只用随包目录）、`com`（只用 Office） |
| `allowPdfSource` | `false` | 是否允许 pdf 作为转换源（默认关闭，原因见"十二、已知限制"） |
| `docTimeoutSeconds` | `180` | 单个文档任务的超时秒数（30~1800）；实际超时还会随源文件大小每 MB 增加 3 秒，上限仍是 1800 秒 |
| `docMaxConcurrency` | `1` | 文档车道并发度（1~4）；保持 1 可确保同时只有一个文档引擎在跑 |
| `docComRetries` | `3` | Office COM 偶发拒绝（例如 RPC 忙）的重试次数（0~5） |
| `docWarmupOnStart` | `true` | 启动时在后台预热一次引擎，把 LibreOffice 首次运行建 profile 的开销挪到用户第一次转换之前 |
| `watchDrives` | `[]` | 监听的盘符，例如 `["D:\\", "E:\\"]`；留空表示监听所有固定磁盘 |
| `skipCloudFiles` | `true` | 是否跳过云盘按需占位文件（RecallOnDataAccess） |

越界值会被自动钳制（`imageQuality` 1~100、`imageConcurrency` 1~8、`docTimeoutSeconds` 30~1800、`docMaxConcurrency` 1~4、`docComRetries` 0~5），无法识别的 `documentEngine` 按 `auto` 处理；配置解析失败会回退默认值并记日志，不影响程序运行。

## 八、支持的格式矩阵

图片（同类别内互转）：

| 源 | 目标 | 处理方式 |
| --- | --- | --- |
| png / jpg / jpeg / bmp / gif / webp / tiff | png / jpg / jpeg / bmp / gif / webp / tiff | Magick.NET 转换；jpg 输出有损（质量可配）、webp 输出无损、gif 源按 `gifPolicy` 取首帧 |
| 任意含 `.ico` 的组合 | — | 静默忽略（仅记日志） |

音视频：

| 场景 | 处理方式 |
| --- | --- |
| 视频容器互转（mp4 / mkv / avi / mov / wmv / ts / webm / flv） | 编码在 `h264 / hevc / aac / ac3 / opus / vorbis / mp3` 且目标容器可容纳时执行 `-c copy` 流拷贝，否则重编码 |
| 音频互转（mp3 / wav / flac / aac / ogg / m4a） | 按目标格式选择编码器（见上文），有损转无损不阻断但会提示 |
| 视频转音频 | 提取音轨并转为目标音频格式 |
| 音频转视频容器 | 仅音频流封装，能 copy 则 copy |
| 不在支持矩阵内的组合 | 静默忽略（仅记日志，不弹任何提示） |

### 文档

文档在同族内转换（源与目标同族，或目标为 pdf）：

| 源族 | 源扩展名 | 目标 |
| --- | --- | --- |
| Writer | docx / doc / docm / dotx / odt / ott / rtf / md / markdown / html / htm / xhtml | docx / doc / odt / ott / rtf / md / markdown / html / htm / xhtml / pdf |
| Impress | pptx / pptm / potx / ppt / odp / otp | pptx / ppt / odp / otp / pdf |
| Calc | xlsx / xlsm / xltx / xls / ods / ots / csv / tsv | xlsx / xls / ods / ots / csv / tsv / pdf |

（`.txt` 既不作源也不作目标：它没有 magic 可校验，不在文档集合内；上表与"处理方式"是完整口径。Writer 源转 `.csv` 属于跨族，会被拒。）

| 场景 | 处理方式 |
| --- | --- |
| 同族转换 | 由选中的引擎直接完成，结果写入同目录临时文件后原子替换 |
| 跨族转换且目标不是 pdf | 拒绝（SKIPPED），原因写明文档跨族转换只允许目标为 pdf（表格请改成 csv / pdf） |
| 任意族 → pdf | 允许，pdf 是唯一的跨族目标 |
| `.docm` / `.xlsm` / `.pptm` | 可作为源，永不作为目标（不生成启用宏的文档） |
| `.pdf` 作源 | 默认关闭（`allowPdfSource: false`）；开启后只保证文字内容，列结构、浮动对象与表格边界会丢失 |
| `md → docx` | 内置转换器，不需要外部引擎 |
| `docx → md` 等 Markdown 输出 | 走外部引擎，输出是"类 Markdown"（只有基本结构） |
| 内容与扩展名不符 | magic 不符即跳过（仅记日志） |

## 九、日志

日志写入程序同级目录的 `log.txt`，每次转换记录时间、旧路径、新路径、结果与错误详情：

```text
[2026-09-25 23:14:25.415] [INFO] [进度] 已打开系统进度对话框（资源管理器传输框同款）
[2026-09-25 23:14:29.010] [INFO] [结果] OK | 旧: D:\demo\rec.mkv | 新: D:\demo\rec.mp4 | 副本: D:\demo\rec - 副本.mkv | 耗时: 4.2s
[2026-09-25 23:25:26.423] [ERROR] [结果] FAILED | 旧: D:\demo\bad.jpg | 新: D:\demo\bad.png | 副本: D:\demo\bad - 副本.jpg | 错误: insufficient image data in file ...
[2026-09-25 23:25:26.427] [INFO] [回滚] 已恢复原名：D:\demo\bad.jpg（副本已移回，不会再被二次转换）
[2026-09-25 23:26:12.347] [WARN] [重试] 原子替换 第 2 次失败（文件被占用），500ms 后重试（最多 3 次）
[2026-09-25 23:31:02.114] [INFO] [文档] 引擎就绪：LibreOffice 25.8.7.3 30742500（D:\demo\RenamePro-full\LibreOffice\program\soffice.com，随包目录）
[2026-09-25 23:31:02.118] [INFO] [文档] 预热完成（1180 ms，首次会创建 LibreOffice 用户配置目录）
[2026-09-25 23:31:05.482] [INFO] [结果] OK | 旧: D:\demo\report.docx | 新: D:\demo\report.pdf | 副本: D:\demo\report - 副本.docx | 耗时: 3.1s
[2026-09-25 23:31:06.117] [INFO] [结果] SKIPPED | 旧: D:\demo\fake.docx | 新: D:\demo\fake.pdf | 原因: magic 不符：内容实为 png，源扩展名 .docx
[2026-09-25 23:31:07.204] [INFO] [结果] SKIPPED | 旧: D:\demo\a.docx | 新: D:\demo\a.xlsx | 原因: 不在支持矩阵内：文档跨族转换只允许目标为 pdf（表格请改成 csv/pdf）
[2026-09-25 23:32:10.884] [ERROR] [结果] FAILED | 旧: D:\demo\thesis.docx | 新: D:\demo\thesis.odt | 副本: D:\demo\thesis - 副本.docx | 错误: 文档转换超时（180 秒，源文件 D:\demo\thesis.docx）
[2026-10-02 09:02:11.004] [INFO] [文档] 引擎就绪：Word 16.0 COM
[2026-10-03 09:02:14.500] [WARN] [文档] 引擎不可用：未找到 LibreOffice（已探测常见安装目录、注册表与 PATH），Office COM 不可用（未注册 Word.Application）
```

结果取值：`OK` / `FAILED` / `CANCELLED` / `SKIPPED`；跳过原因包含"新旧扩展名不属于同一媒体集合""扩展名未变化""位于排除目录""magic 不符""ffmpeg.exe 缺失""不在支持矩阵内"等。监听器缓冲区溢出时记录丢失事件的时间窗口。

## 十、测试与验证

文档转换比图片麻烦：真正决定质量的是"外部引擎转出来的文件长什么样"，所以除了 `--selftest`，项目还准备了三层校验。

`verify-docengine.ps1` 有三种模式，分别对应三种引擎来源：

| 模式 | 命令 | 验的是什么 |
| --- | --- | --- |
| 真实引擎直连 | `verify-docengine.ps1 -Soffice <soffice.com> -KeepRunning` | 通过 `RENAMEPRO_SOFFICE` 指向开发用的 LibreOffice 树，验转换质量 |
| 随包引擎目录 | `verify-docengine.ps1 -EngineDir .\libreoffice` | 把 `RENAMEPRO_DOCENGINE` 指向裁剪树、`documentEngine` 设为 `bundled`，验"裁剪没裁坏"与引擎发现路径 |
| 发布包目录包 | `publish.ps1 -Mode Docs` 后 `verify-docengine.ps1 -Package .\dist\RenamePro-full-v2.0.0.zip` | 解压发布包，用包里的 exe + 同级 `LibreOffice\` 跑完整矩阵，最接近用户实际拿到的形态 |

三种模式都会生成真实夹具（含中文标题、表格、图片、多页 PPT、多工作表、Markdown、HTML）→ 写测试用 `config.json` → 启动托盘程序 → 逐个改名 → 断言产物 magic 与日志结果 → 打印 PASS/FAIL 表并给出退出码。`-Package` 模式还会额外断言：日志里的引擎来源是「随包目录」，且 `%RENAMEPRO_DOCROOT%\runtime` 下**没有** `doc-*` 目录（目录版不该再解压任何载荷）。

覆盖的 15 条用例：

| 类型 | 用例 | 期望 |
| --- | --- | --- |
| 成功 | `report.docx → report.pdf` | OK，产物 `%PDF-`，副本生成 |
| 成功 | `slides.pptx → slides.pdf` | OK |
| 成功 | `sheet.xlsx → sheet.pdf` | OK |
| 成功 | `sheet.xlsx → sheet.csv` | OK，首工作表导出 |
| 成功 | `report.docx → report.odt` | OK，PK + mimetype |
| 成功 | `report.odt → report.docx` | OK（覆盖导入侧过滤器） |
| 成功 | `report.docx → report.html` | OK |
| 成功 | `page.html → page.pdf` | OK |
| 成功 | `notes.md → notes.docx` | OK（**内置转换器，不需要引擎**） |
| 失败 | `report.docx → report.xlsx` | SKIPPED，原因提到 csv/pdf |
| 失败 | PNG 改名成 `.docx` | SKIPPED，原因 `不在文档集合内` |
| 失败 | pptx 内容装成 `.docx` | SKIPPED，原因 `magic 不符` |
| 边界 | 只读文件 | OK，只读位恢复，无残留工作目录 |
| 边界 | 中文 + 空格文件名 | OK |
| 回归 | `photo.jpg → photo.png` | OK，产物是真 PNG |

另外还有一个**桩引擎**（`test/stub-engine/`）：它冒充 `soffice.com`，不依赖真实 LibreOffice，专门验"集成链路"——参数拼接、产物找回、原子替换、降级。这样在没有装 LibreOffice 的环境里也能跑通流程测试，真实引擎则负责验转换质量。

文档测试里有两件事值得提前知道：LibreOffice 首次使用某个 profile 会创建用户配置目录，第一次转换会慢几秒（启动预热通常已经做过）；Office COM 在沙箱 / 服务会话 / 受限账户下可能直接失败（Word 与 Excel 比 PowerPoint 更容易遇到），这时改用 LibreOffice 路由即可，不是程序缺陷。

## 十一、开发里程碑

项目按五个里程碑迭代完成，每个里程碑均有独立提交与实机验收：

| 里程碑 | 内容 |
| --- | --- |
| 1 | 项目骨架、固定磁盘改名监听与过滤、托盘图标与退出菜单、开机自启动、暂停监听 |
| 2 | 备份管理器、分级调度队列（快速 2 / 图片 2 / 音视频 1）、Magick.NET 图片与 FFmpeg 音视频转换器、主流程串联 |
| 3 | 专用 STA 消息线程、`IOperationsProgressDialog` 封装、进度聚合与取消、Shell COM 失败降级与 Toast |
| 4 | `config.json` 配置化、失败回滚、资源控制（Magick 延迟加载与内存上限）、边界加固、便携打包脚本 |
| 5 | 文档转换：无头 LibreOffice / Office COM 路由、转换矩阵与 magic 校验、内置 Markdown → docx、`--selftest` 与 `--docdiagnose` 排障入口；v2.0 把文档引擎从"内置载荷"改为随包 `LibreOffice\` 目录，发布拆成 image / av / full 三个包 |

## 十二、已知限制

- 仅支持 Windows 10 / 11 x64（依赖 Shell COM 与 WinRT 系统组件）；
- Windows 11 的通知区若把图标折叠进"隐藏的图标"，需要用户在系统设置中手动固定，这是系统行为；
- 预计或实际耗时小于 400ms 的任务不会显示进度框（防闪烁设计，属预期行为）；
- 云盘按需占位文件的跳过逻辑已实现，但需要 OneDrive 等真实按需同步环境才能实测；
- 修改 `config.json` 的 `imageConcurrency` 时若队列正在忙碌，需下次启动生效；
- 涉及 `.ico` 的改名与未列入支持矩阵的组合会被静默忽略（只写日志，不弹提示）；
- 文档跨族转换（目标不是 pdf）按设计拒绝，只记一行 SKIPPED；
- `docx → md` 只保留基本 Markdown 结构；`md → docx` 不携带 Word 样式与主题；
- pdf 作源默认关闭，开启后也只保证文字内容（列结构、浮动对象与表格边界会丢失）；
- 文档引擎是重量级外部程序，第一次转换需要等引擎与 profile 预热，可能耗时数秒；
- 同一文档已在 Word / PowerPoint / Excel 中打开时 Office COM 无法工作，需要先关闭该文档；
- Office COM 依赖运行环境：在沙箱 / 服务会话 / 受限账户下，Word 与 Excel 的自动化可能直接报错（PowerPoint 通常仍然可用）。若命中这种情况，请改用 LibreOffice（`documentEngine` 设为 `"libreoffice"`），或把该机器上的 Office 自动化排除在外；
- `bundled` 路由只认**随包引擎目录**（全功能版的 `LibreOffice\`）；图片版 / 音视频版没有这个目录，该档不可用（日志会写明找的是哪个路径）；
- 全功能版是**目录包**：`RenamePro.exe` 必须与同级 `LibreOffice\` 一起使用。单独把 exe 复制走不会报错，只会退化为"只用系统 LibreOffice / Office COM"；
- 程序目录必须可写：`config.json`、`log.txt` 就写在 exe 同级；因此不建议把全功能版放进 `Program Files`（其 `LibreOffice\` 也不需要写权限，LibreOffice 的用户配置写在 `%LOCALAPPDATA%\RenamePro\DocEngine`）；
- 单文件 exe（图片版 / 音视频版 / 全功能版的主程序）首次启动要把包内文件解压到 `%TEMP%\.net\RenamePro\<hash>\`：若 `%TEMP%` 不可写（受限账户、被安全软件锁死的临时目录），进程会直接以 `Failed to create default extraction directory … error code: 5` 退出、连 `log.txt` 都不会生成。此时把环境变量 `DOTNET_BUNDLE_EXTRACT_BASE_DIR` 指向一个可写目录即可；这与文档引擎（普通目录，不解压）无关；
- 随包引擎是一次性复制 700 MB / 4500 多个文件，首次被安全软件全量扫描时第一次转换会明显变慢，之后恢复正常；
- Office COM 自动化需要正常的交互式桌面会话。

## 十三、第三方组件与许可

| 组件 | 用途 | 许可说明 |
| --- | --- | --- |
| Magick.NET / ImageMagick | 图片格式转换 | Apache-2.0 与 ImageMagick License（详见其官方仓库） |
| FFmpeg / ffprobe | 音视频转换与探测 | GPL（含 libx264 的构建即为 GPL）；本仓库不包含其二进制文件，发布包内的两个 exe 由 [build-ffmpeg.ps1](https://github.com/Ha2eS1onn/RenamePro/blob/main/build-ffmpeg.ps1) 以 `--enable-gpl` 自行精简编译，源码与编译开关可复现，分发时请遵守对应许可并注明来源 |
| 随包运行时 DLL | x264 / lame / opus / vorbis / libvpx / libogg / libiconv / zlib / winpthread | 各自遵循其上游许可（GPL / LGPL / BSD 等）；它们与两个 exe 一起被压成载荷嵌入音视频版 / 全功能版的 exe，运行时解压到用户目录，未纳入版本库 |
| Microsoft.Windows.SDK.NET | WinRT Toast 投影 | 随 .NET 8 目标框架提供，无需额外 NuGet 包 |
| LibreOffice | 文档转换引擎（全功能版随包分发 `LibreOffice\`；其它版本仅在用户机器上已安装且被 `documentEngine` 选中时使用） | MPL-2.0（文件级 copyleft，与本项目的 GPL-3.0 兼容）；本仓库不包含其二进制文件，全功能版包内的 `LibreOffice\` 由 [build-docengine.ps1](https://github.com/Ha2eS1onn/RenamePro/blob/main/build-docengine.ps1) 从官方安装包裁剪而来，并随附 `LibreOffice\licenses\` 下的许可与第三方声明；需要源码时请取官方对应版本（LibreOffice 25.8.7） |

## 十四、开源许可

本项目以 **GNU General Public License v3.0（GPL-3.0）** 发布，完整条款见仓库根目录的 [LICENSE](https://github.com/Ha2eS1onn/RenamePro/blob/main/LICENSE)。

- 你可以自由使用、修改与再分发本项目；分发衍生作品时必须同样以 GPL-3.0 授权并提供完整源代码；
- 本仓库已包含全部源代码，满足 GPL-3.0 对源码提供的要求；
- 发布包内的 `ffmpeg.exe` / `ffprobe.exe` 属于 FFmpeg 项目，其许可取决于具体构建（含 libx264 等组件的构建为 GPL）；分发时请一并遵守 FFmpeg 的许可要求并注明来源；
- 图片转换使用的 Magick.NET / ImageMagick 以 Apache-2.0 与 ImageMagick License 发布，与本项目的 GPL-3.0 兼容；
- 全功能版随包的 `LibreOffice\` 以 MPL-2.0 发布，与本项目的 GPL-3.0 兼容；其许可以及第三方声明随包放在 `LibreOffice\licenses\` 下。

使用本工具进行批量文件转换时，请自行确认对目标文件拥有处理权限。
