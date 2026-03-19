# ChatPortal X1

ChatPortal X1 是一个面向 Windows 的桌面客户端，集成了联系人聊天、房间消息和内置 ChatGPT 网页，并提供 Sender / Receiver 两种运行模式。

## 功能
- Sender / Receiver 双模式
- 账号登录、联系人列表、私聊、房间消息
- 内置 ChatGPT 网页
- AI 使用统计
- Windows 便携打包

## 下载
Windows 发行版建议通过 GitHub Releases 提供：

```text
https://github.com/Sjeary/singbox-client/releases
```

常用发行文件：
- `chatportal-x1-sender-<version>.exe`
- `chatportal-x1-receiver-<version>.exe`
- `chatportal-x1-<version>.exe`

## Windows 使用
### Sender
1. 下载 `chatportal-x1-sender-<version>.exe`
2. 运行程序
3. 登录账号
4. 填写连接设置并启动发送服务
5. 使用联系人聊天或内置 ChatGPT 网页

### Receiver
1. 下载 `chatportal-x1-receiver-<version>.exe`
2. 运行程序
3. 填写接收端设置
4. 启动接收服务

## 主要页面
### Sender
- `连接设置`
- `运行记录`
- `账号与信息`
- `ChatGPT 网页`
- `联系人与聊天`
- `AI 使用统计`

未登录时只显示登录页。

### Receiver
- `接收端设置`
- `运行记录`

## 内置 ChatGPT 网页
- 使用 Electron 内嵌 Chromium 打开 ChatGPT
- 通过本地 `sing-box` 代理访问
- 切换页面后尽量保留原来的会话位置
- 支持前进、后退、刷新、全屏和浏览器打开

## Windows 打包
### 统一便携包
```bash
npm run dist:win
```

### Sender 单独分发
```bash
npm run dist:win:sender
```

### Receiver 单独分发
```bash
npm run dist:win:receiver
```

### 同时打包 Sender 和 Receiver
```bash
npm run dist:win:split
```

也可以直接使用这些脚本：
- `build_win_portable.bat`
- `build_win_sender.bat`
- `build_win_receiver.bat`
- `build_win_split.bat`

默认输出目录：
- `release/`
- `release_sender/`
- `release_receiver/`

GitHub Release 建议上传：
- `release_sender/chatportal-x1-sender-<version>.exe`
- `release_receiver/chatportal-x1-receiver-<version>.exe`
- `release/chatportal-x1-<version>.exe`

## 运行环境
- Node.js 20+
- npm 10+ 推荐
- Windows 优先

## 从源码运行
### 安装依赖
```bash
npm install
```

## 公开仓库与本地私有配置
仓库默认不再包含你的私有服务地址、UUID、口令和默认账号信息。

如需在本机保留调试配置，可以使用：

- `private.defaults.local.json`

这个文件不会进入 Git。

模板文件：

- `private.defaults.local.example.json`

使用方式：
1. 复制 `private.defaults.local.example.json`
2. 重命名为 `private.defaults.local.json`
3. 填入你自己的服务器地址、端口、UUID 和账号

程序启动时会优先读取这个本地文件，再读取用户目录中的运行设置。

### 本地运行
```bash
npm run dev
```

### Sender
```bash
npm run dev:sender
```

### Receiver
```bash
npm run dev:receiver
```

## 仓库内容
- `src/`
  - Electron 主进程、预加载脚本、页面和样式
- `build/bin/`
  - 运行依赖二进制
  - 包含 `sing-box.exe`、`frpc.exe`
- `scripts/prepare-assets.mjs`
  - 启动和打包前整理运行资源
- `collab_server/`
  - 登录、聊天、在线状态和 AI 使用统计服务端

## 协作服务端
快速启动：

```bash
cd collab_server
npm install
node add_user.js admin MyStrongPass123
npm start
```

客户端服务地址示例：

```text
http://你的服务器IP:8088
```

更完整的部署说明见：
- `collab_server/README.md`

## Git
克隆仓库：

```bash
git clone git@github.com:Sjeary/singbox-client.git
cd singbox-client/v3_electron
```

查看状态：

```bash
git status
```

提交：

```bash
git add .
git commit -m "your message"
```

推送：

```bash
git push
```

## 说明
- 仓库中保留源码、构建配置和运行所需二进制
- `node_modules/`、`release*/`、服务端运行数据不会进入 Git
