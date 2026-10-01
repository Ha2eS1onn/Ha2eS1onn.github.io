---
title: RenamePro
comments: true
date: 2026-10-01
tags:
  - Windows
  - C#
  -  .NET 8
  - vibe coding
categories:
  - 开发
---
# RenamePro

在资源管理器里改文件后缀（例如 `a.jpg` 改成 `a.png`），程序在后台自动把文件内容真正转换成新格式的 Windows 托盘工具。

它不新增右键菜单、不弹自定义主窗口、不出现控制台窗口：双击运行后只是一个托盘图标，之后完全跟随你在资源管理器里的改名动作工作。

## 一、项目简介

Windows 只改文件后缀并不会改变文件内容，改完常常得到一个"名字是 PNG、内容其实是 JPEG"的坏文件（图片打不开、播放器报错）。RenamePro 监听系统里的文件改名事件，识别出"后缀变了且新旧格式属于同一媒体类别"的情况后自动完成三件事：

1. 先把改名后的文件原样复制为原格式副本（`a - 副本.jpg`），保证可回退；
2. 再把文件内容转换为新格式，写入同目录临时文件后原子替换；
3. 转换过程通过系统资源管理器同款的进度对话框展示，可取消。

## 二、核心特性

### 监听与判定

- 监听**所有固定磁盘**（可在 `watchDrives` 中限定盘符），`IncludeSubdirectories` 递归整个磁盘；
- 性能优先：`NotifyFilter` 只设 `FileName`（改名事件只依赖文件名通知），缓冲区 256KB；
- 监听器出错时按 `1s / 5s / 30s` 指数退避自动重建，并在日志中记录缓冲区溢出丢失的时间窗口；
- 四级早退判定（按开销升序）：内部操作抑制表 → 扩展名白名单 → 排除目录 → 排除文件名模式；
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

### 备份与失败处理

- 转换前生成原格式副本，命名跟随系统 UI 语言：中文系统 `a - 副本.jpg`，英文系统 `a - copy.jpg`；同名冲突自动递增为 `a - 副本 (2).jpg`；
- 副本与目标同目录，**程序永不自动删除副本**；
- 特殊文件跳过：EFS 加密文件、云盘按需占位文件（`skipCloudFiles`）；只读文件在替换前临时清除只读位、替换完成后恢复；
- 文件占用（IOException）按 500ms 间隔重试最多 3 次，仍失败则任务失败且不留半成品（临时文件清理、目标文件保持原状）；
- 默认保守策略：失败只记录日志不回滚；开启 `autoRollbackOnFailure` 后，失败会删除目标文件并把副本移回原名——移动前登记内部操作抑制表，确保恢复后的文件不会被再次转换。

### 进度与通知

- 进度对话框直接封装系统 Shell COM 接口 `IOperationsProgressDialog`，外观与资源管理器传输框一致；
- Shell COM 要求 STA 与消息循环，因此程序维护一个**专用 STA 消息线程**，对话框的创建、进度更新、销毁全部通过 `Invoke / BeginInvoke` 封送到该线程执行；
- 多任务聚合显示：同一批次共用一个对话框，按已完成任务数与当前任务内进度合成总进度；未知总量（流拷贝没有总时长）自动切换为滚动条模式；
- 小于 400ms 的快速任务不弹进度框（防闪烁），静默完成；
- 取消：在进度框点"取消"会取消整个队列，正在运行的 FFmpeg 进程树被终止、副本保留、目标文件不被破坏；
- 任务全部完成后可弹 Windows Toast 汇总（`enableToast`），失败任务带"失败"前缀行；Toast 不可用时自动回退为托盘图标闪烁；
- 任何 Shell COM 失败都会**整体降级**为静默转换 + 完成 Toast，并在日志记录，绝不会因为界面组件异常而影响转换本身。

### 可靠性与资源占用

- 单实例：命名互斥体保证只运行一个实例，重复双击只提示不新开；
- 托盘图标在 Explorer 重启或登录早期通知区未就绪时自动重建；
- 开机自启通过任务计划程序注册（登录时运行），任务指向的 exe 路径过期时自动纠正；
- Magick.NET 延迟加载：只有真正执行图片转换时才加载 Magick 程序集与原生库，启动时不触碰；
- Magick 内存上限 512MB，防止超大图片拖垮系统；
- 实测空载工作集约 57MB、私有内存约 12MB（未加载 Magick 时）。

### 便携与配置

- 绿色免安装：解压后双击 `RenamePro.exe` 即用；配置与日志都在程序同级目录；
- `config.json` 首次运行自动生成，带中文注释，可用记事本直接修改，托盘菜单"重新加载配置"即时生效（个别项需重启）。

## 三、技术栈

| 分类 | 选型与说明 |
| --- | --- |
| 语言 / 运行时 | C# 12 / .NET 8，目标框架 `net8.0-windows10.0.19041.0`（win-x64） |
| 界面 | WinForms，但只使用 `NotifyIcon` 托盘图标与 `ContextMenuStrip`，无主窗口、无控制台（`OutputType=WinExe`） |
| 图片转换 | Magick.NET-Q16-AnyCPU（**项目中唯一允许的第三方 NuGet 包**），配合 Magick 进度事件回报百分比 |
| 音视频转换 | FFmpeg：`ffmpeg.exe` 以子进程方式调用，`ffprobe.exe` 负责探测；进度用 `-progress pipe:1` 解析，错误取 `stderr` |
| 文件监听 | `FileSystemWatcher`（仅 `FileName` 通知 + 256KB 缓冲），辅以自实现的 300ms 防抖调度器 |
| 系统集成 | Shell COM `IOperationsProgressDialog`（手写 Interop，含 `IShellItem`）、WinRT Toast（`Windows.UI.Notifications`）、任务计划程序（`schtasks`）、命名互斥体、Explorer 广播消息 `TaskbarCreated`、Shell 属性存储（写入 AUMID）、`CreateProcess` 风格的子进程调用 |
| 并发模型 | `Task` + `SemaphoreSlim` 分级队列、`CancellationTokenSource` 取消、专用 STA 消息线程封送、`ConcurrentDictionary` 防重入与抑制表 |
| 配置与日志 | `System.Text.Json`（允许注释与尾逗号的宽容解析）、线程安全追加式日志 |
| 打包 | 单文件自包含发布（开启单文件内压缩、关闭 ReadyToRun、不使用 PublishTrim）+ PowerShell 打包脚本，产物为绿色 zip |

设计约束：不使用 `PublishTrim`（会破坏 COM Interop 与反射路径），不使用 `ReadyToRun`（体积翻倍），除 Magick.NET 之外不引入任何第三方包。

### 发布体积构成（实测）

`RenamePro.csproj` 在发布期剔除 WPF / 设计器 / 调试符号程序集，`EnableCompressionInSingleFile` 对单文件包内做 deflate；FFmpeg 为项目自行精简编译并**内置进 exe**（见下）。

| 产物 | 体积 | 说明 |
| --- | --- | --- |
| `RenamePro.exe`（完整版） | 83.1 MB | 含 13.4 MB 内置 FFmpeg 载荷；运行时、WinForms、Magick.NET 原生库全在其中 |
| `RenamePro-完整版-*.zip` | 77.5 MB | **包内只有 `RenamePro.exe` + 使用说明**，图片与音视频功能齐全 |
| `RenamePro.exe`（图片版） | 69.7 MB | 不嵌入 FFmpeg 载荷，音视频改名写日志跳过 |
| `RenamePro-图片版-*.zip` | 64.2 MB | 同样只有 exe + 使用说明 |
| `ffmpeg\` 目录（本地构建源） | 34.4 MB | 2 个 exe + 10 个运行时 DLL；精简编译前是官方 essentials 构建，两个 exe 合计 201 MB |
| 仓库源码 + 图标 | 约 350 KB | 二进制、DLL、载荷与打包产物均不入库 |

开启单文件压缩的代价是**首次启动**要把包内文件解压到 `%TEMP%\.net\RenamePro\<hash>\`（同一版本只解压一次，之后直接复用缓存）：实测冷启动约 1.3～1.9 秒，热启动约 30 毫秒。不想承担这个首启代价时，删掉 `RenamePro.csproj` 里的 `EnableCompressionInSingleFile` 即可回到未压缩单文件。

### 单文件是怎么做到的（FFmpeg 载荷）

完整版发布包解压后只有一个 `RenamePro.exe`。ffmpeg 并没有被编译进去，而是这样交付：

1. `publish.ps1` 把 `ffmpeg\` 下全部文件（2 个 exe + 10 个 DLL）压成**一个** `Assets\ffmpeg-payload.zip`（约 13.4 MB）；
2. 该 zip 以 `EmbeddedResource` 形式在**编译期**写进程序集（`EmbeddedResource` 由 C# 编译器处理，与单文件打包器无关，所以不需要 `ExcludeFromSingleFile`）；
3. 运行时由 [RuntimePayload.cs](https://github.com/Ha2eS1onn/RenamePro/blob/main/Conversion/RuntimePayload.cs) 在**首次需要音视频转换时**惰性解压到：
   ```
   %LOCALAPPDATA%\RenamePro\runtime\<载荷ID>\
   ```
   载荷 ID 是载荷字节的 SHA256 前 16 位，因此升级 FFmpeg 会自动换目录，旧目录随后被后台清理；
4. [AvConverter](https://github.com/Ha2eS1onn/RenamePro/blob/main/Conversion/AvConverter.cs#L88) 从该目录调用 `ffmpeg.exe` / `ffprobe.exe`。

**为什么必须落盘**：Windows 加载器只按磁盘路径加载模块。`ffmpeg.exe` 是 `CreateProcess` 启动的子进程，它依赖的 10 个 DLL 要由加载器在 exe 同目录搜索，程序集里的嵌入资源对加载器不可见——"一个文件都不落盘"在 Windows 上做不到，能做到的是"用户只拿到一个文件"。

实测行为：

- 解压 34.4 MB 载荷耗时 **约 150 ms**（同一版本只解一次，之后每次启动直接复用）；
- 解压发生在**第一次音视频转换**时，不在启动路径上：只做图片转换的用户永远不会解压，托盘启动耗时与图片版一致；
- 首选目录不可写（受限环境）时自动退回 `%TEMP%\RenamePro\runtime\<载荷ID>\`；
- 两者都失败、或 DLL 被安全软件拦截时，音视频功能被禁用并把原因写进 `log.txt`，**图片转换不受影响**；
- 程序目录里放了 ffmpeg.exe / ffprobe.exe 时（开发期 `dotnet build` 的输出目录），直接用程序目录，不走解压。

> 完整版与图片版必须是**两次独立发布**：载荷在编译期嵌入，同一次发布的产物不可能既带又不带它。`publish.ps1 -Mode Both` 已经按这个顺序做（先带载荷出完整版，再把载荷临时移开出图片版）。

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
powershell -ExecutionPolicy Bypass -File publish.ps1 -Mode Both       # 生成载荷并打包
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
        ├─ 扩展名白名单（新旧后缀归一化后不同，且同属图片 / 音视频类别）
        ├─ 排除目录（系统目录、回收站、卷影副本）
        └─ 排除文件名（~$、. 开头）
        │
        ▼
300ms 防抖合并（同一路径只处理最后一次）
        │
        ▼
转换主流程：防重入 → 特殊文件检查 → magic number 校验 → ffprobe 探测分类
        │
        ├─ 快速通道（并发 2）：FFmpeg 流拷贝、小于 2MB 的图片
        ├─ 图片队列（并发 = imageConcurrency）：Magick.NET 位图转换
        └─ 音视频队列（并发 1）：需要重编码的 FFmpeg 任务
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
├── Watching/              FileSystemWatcher 监听封装、300ms 防抖调度
├── Conversion/            转换主流程、分级调度队列、备份管理器、图片转换器、音视频转换器、FFmpeg 载荷管理
├── Interop/               Shell COM 进度对话框声明与包装、IShellItem / AUMID 辅助
├── Progress/              进度聚合器、专用 STA 消息线程、Toast 通知服务
├── Tray/                  托盘上下文、Shell 广播消息窗口（通知区重建）
├── ffmpeg/                ffmpeg.exe、ffprobe.exe 与 10 个运行时 DLL（构建源，未纳入版本库）
├── Assets/ffmpeg-payload.zip  上述文件压成的单个载荷（构建产物，不入库，编译期嵌入 exe）
├── app.manifest           Win10/11 兼容性声明与 DPI 设置
├── RenamePro.csproj       项目文件（体积优化目标、载荷嵌入、开发期 ffmpeg 复制规则）
├── build-ffmpeg.ps1       精简版 FFmpeg 构建脚本（白名单 configure + 复制运行时 DLL）
├── verify-ffmpeg.ps1      FFmpeg 校验脚本（55 项能力与转换冒烟 + 26 项载荷一致性）
└── publish.ps1            便携打包脚本（生成载荷、两次发布、打 zip）
```

## 六、快速开始

### 方式一：使用发布包（推荐）

1. 到 Releases 页面下载：
   - `RenamePro-Full-*.zip`（完整版）：内置 FFmpeg，图片与音视频功能齐全；
   - `RenamePro-Image-*.zip`（图片版）：体积最小，仅图片转换，音视频改名会写日志跳过；
2. 解压任意目录：**里面只有一个 `RenamePro.exe`**（外加使用说明），双击即可——无窗口，托盘出现图标；
3. 在资源管理器里改文件后缀即可，例如 `photo.jpg` 改为 `photo.png`；
4. 托盘图标右键菜单：暂停监听 / 继续监听、开机自启动、重新加载配置、退出。

首次运行会在程序目录生成 `config.json`（带中文注释）与 `log.txt`。首次勾选"开机自启动"或程序自动注册自启动时会弹一次 UAC，允许即可。

完整版第一次做音视频转换时，会把内置的 FFmpeg 解压到 `%LOCALAPPDATA%\RenamePro\runtime\`（约 150 毫秒，只此一次），这是正常行为；只做图片转换不会触发。

### 方式二：从源码构建

```powershell
# 环境要求：.NET 8 SDK、Windows 10/11 x64
git clone https://github.com/Ha2eS1onn/RenamePro.git
cd RenamePro
# 音视频功能需要 ffmpeg：用 build-ffmpeg.ps1 自己编精简版（推荐），
# 或把任意 ffmpeg.exe / ffprobe.exe（含所需 DLL）放进 ffmpeg\ 目录
dotnet build RenamePro.csproj -c Debug
```

### 打包便携发布包

```powershell
# 生成完整版与图片版 zip（默认输出到 dist\）
powershell -ExecutionPolicy Bypass -File publish.ps1
# 只出某一个包 / 指定版本号
powershell -ExecutionPolicy Bypass -File publish.ps1 -Mode Image -Version 1.1.0
```

> 这两个脚本都以 UTF-8 保存；用 `powershell.exe`（Windows PowerShell 5.1）执行时请确认脚本按 UTF-8 解码，否则其中的中文注释会被当作 ANSI 而报语法错误（仓库内脚本已带 BOM，正常情况无此问题）。用 PowerShell 7 执行不受影响。

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
| `watchDrives` | `[]` | 监听的盘符，例如 `["D:\\", "E:\\"]`；留空表示监听所有固定磁盘 |
| `skipCloudFiles` | `true` | 是否跳过云盘按需占位文件（RecallOnDataAccess） |

越界值会被自动钳制（`imageQuality` 1~100、`imageConcurrency` 1~8），配置解析失败会回退默认值并记日志，不影响程序运行。

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

## 九、日志

日志写入程序同级目录的 `log.txt`，每次转换记录时间、旧路径、新路径、结果与错误详情：

```text
[2026-09-25 23:14:25.415] [INFO] [进度] 已打开系统进度对话框（资源管理器传输框同款）
[2026-09-25 23:14:29.010] [INFO] [结果] OK | 旧: D:\demo\rec.mkv | 新: D:\demo\rec.mp4 | 副本: D:\demo\rec - 副本.mkv | 耗时: 4.2s
[2026-09-25 23:25:26.423] [ERROR] [结果] FAILED | 旧: D:\demo\bad.jpg | 新: D:\demo\bad.png | 副本: D:\demo\bad - 副本.jpg | 错误: insufficient image data in file ...
[2026-09-25 23:25:26.427] [INFO] [回滚] 已恢复原名：D:\demo\bad.jpg（副本已移回，不会再被二次转换）
[2026-09-25 23:26:12.347] [WARN] [重试] 原子替换 第 2 次失败（文件被占用），500ms 后重试（最多 3 次）
```

结果取值：`OK` / `FAILED` / `CANCELLED` / `SKIPPED`；跳过原因包含"新旧扩展名不属于同一媒体集合""扩展名未变化""位于排除目录""magic 不符""ffmpeg.exe 缺失""不在支持矩阵内"等。监听器缓冲区溢出时记录丢失事件的时间窗口。

## 十、开发里程碑

项目按四个里程碑迭代完成，每个里程碑均有独立提交与实机验收：

| 里程碑 | 内容 |
| --- | --- |
| 1 | 项目骨架、固定磁盘改名监听与过滤、托盘图标与退出菜单、开机自启动、暂停监听 |
| 2 | 备份管理器、分级调度队列（快速 2 / 图片 2 / 音视频 1）、Magick.NET 图片与 FFmpeg 音视频转换器、主流程串联 |
| 3 | 专用 STA 消息线程、`IOperationsProgressDialog` 封装、进度聚合与取消、Shell COM 失败降级与 Toast |
| 4 | `config.json` 配置化、失败回滚、资源控制（Magick 延迟加载与内存上限）、边界加固、便携打包脚本 |

## 十一、已知限制

- 仅支持 Windows 10 / 11 x64（依赖 Shell COM 与 WinRT 系统组件）；
- Windows 11 的通知区若把图标折叠进"隐藏的图标"，需要用户在系统设置中手动固定，这是系统行为；
- 预计或实际耗时小于 400ms 的任务不会显示进度框（防闪烁设计，属预期行为）；
- 云盘按需占位文件的跳过逻辑已实现，但需要 OneDrive 等真实按需同步环境才能实测；
- 修改 `config.json` 的 `imageConcurrency` 时若队列正在忙碌，需下次启动生效；
- 涉及 `.ico` 的改名与未列入支持矩阵的组合会被静默忽略（只写日志，不弹提示）。

## 十二、第三方组件与许可

| 组件 | 用途 | 许可说明 |
| --- | --- | --- |
| Magick.NET / ImageMagick | 图片格式转换 | Apache-2.0 与 ImageMagick License（详见其官方仓库） |
| FFmpeg / ffprobe | 音视频转换与探测 | GPL（含 libx264 的构建即为 GPL）；本仓库不包含其二进制文件，发布包内的两个 exe 由 [build-ffmpeg.ps1](https://github.com/Ha2eS1onn/RenamePro/blob/main/build-ffmpeg.ps1) 以 `--enable-gpl` 自行精简编译，源码与编译开关可复现，分发时请遵守对应许可并注明来源 |
| 随包运行时 DLL | x264 / lame / opus / vorbis / libvpx / libogg / libiconv / zlib / winpthread | 各自遵循其上游许可（GPL / LGPL / BSD 等）；它们与两个 exe 一起被压成载荷嵌入完整版 exe，运行时解压到用户目录，未纳入版本库 |
| Microsoft.Windows.SDK.NET | WinRT Toast 投影 | 随 .NET 8 目标框架提供，无需额外 NuGet 包 |

## 十三、开源许可

本项目以 **GNU General Public License v3.0（GPL-3.0）** 发布，完整条款见仓库根目录的 [LICENSE](https://github.com/Ha2eS1onn/RenamePro/blob/main/LICENSE)。

- 你可以自由使用、修改与再分发本项目；分发衍生作品时必须同样以 GPL-3.0 授权并提供完整源代码；
- 本仓库已包含全部源代码，满足 GPL-3.0 对源码提供的要求；
- 发布包内的 `ffmpeg.exe` / `ffprobe.exe` 属于 FFmpeg 项目，其许可取决于具体构建（含 libx264 等组件的构建为 GPL）；分发时请一并遵守 FFmpeg 的许可要求并注明来源；
- 图片转换使用的 Magick.NET / ImageMagick 以 Apache-2.0 与 ImageMagick License 发布，与本项目的 GPL-3.0 兼容。

使用本工具进行批量文件转换时，请自行确认对目标文件拥有处理权限。


