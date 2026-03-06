# 网络连接助手（v3_electron）

这是当前在持续开发的 Electron 桌面端项目。

项目目标：
- 提供 `Sender` 和 `Receiver` 两套独立运行模式
- 在桌面端统一管理连接设置、运行状态、日志和账号协作功能
- 支持 Windows 便携分发

## 目录说明
- `src/`
  - Electron 主进程、预加载脚本、渲染层页面与样式
- `build/bin/`
  - 运行所需二进制，当前已纳入 Git
  - 包含 `sing-box.exe`、`frpc.exe`
- `scripts/prepare-assets.mjs`
  - 启动和打包前执行
  - 优先复用仓库内 `build/bin/` 的二进制
- `collab_server/`
  - 账号登录、在线状态、联系人列表、聊天消息所需的服务端

## 已提交到 Git 的必要内容
当前仓库已经包含跨设备开发必需文件：
- 前端和主进程源码
- Electron 构建配置
- Windows 启动脚本和打包脚本
- `build/bin/` 中的运行二进制
- 协作服务端源码

不会进入 Git 的内容：
- `node_modules/`
- `release/`、`release_sender/`、`release_receiver/`
- `collab_server/node_modules/`
- `collab_server/data/`
- 日志文件和临时打包文件

## 新设备开发准备
### 1. 拉取仓库
```bash
git clone git@github.com:Sjeary/singbox-client.git
cd singbox-client
```

### 2. 安装桌面端依赖
```bash
cd v3_electron
npm install
```

### 3. 如需协作服务端，再安装服务端依赖
```bash
cd collab_server
npm install
```

## 运行环境
- Node.js 20+
- npm 10+ 推荐
- Windows 开发环境优先

## 开发启动
### Windows 脚本
- Sender 开发模式：
```bat
start_dev_windows.bat
```

- Receiver 开发模式：
```bat
start_receiver_dev_windows.bat
```

- Sender 专用脚本：
```bat
start_sender_dev_windows.bat
```

### npm 命令
- 统一入口：
```bash
npm run dev
```

- Sender：
```bash
npm run dev:sender
```

- Receiver：
```bash
npm run dev:receiver
```

## 当前界面结构
### Sender
- `连接设置`
- `运行记录`
- `账号与信息`
- `联系人与聊天`

未登录时只显示登录页。

### Receiver
- `接收端设置`
- `运行记录`

Receiver 不混入 Sender 的账号和聊天页面。

## 打包
### Windows 便携包
- 统一界面：
```bash
npm run dist:win
```

- Sender 单独分发：
```bash
npm run dist:win:sender
```

- Receiver 单独分发：
```bash
npm run dist:win:receiver
```

- 同时打包 Sender 和 Receiver：
```bash
npm run dist:win:split
```

### 常用 Windows 打包脚本
- `build_win_portable.bat`
- `build_win_sender.bat`
- `build_win_receiver.bat`
- `build_win_split.bat`

### 输出目录
- `release/`
- `release_sender/`
- `release_receiver/`

## 资源文件说明
运行和打包前会执行 `prepare-assets`。

当前优先级：
1. `build/bin/`
2. 外部历史目录 `v2/assets/<platform>/`
3. 其他兜底路径

因为 `build/bin/` 已进仓库，所以在其他设备上通常不需要再手工复制 `sing-box` 和 `frpc`。

## 协作服务端
服务端目录：
- `collab_server/`

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

## Git 工作流
### 查看状态
```bash
git status
```

### 提交修改
```bash
git add .
git commit -m "说明这次改了什么"
```

### 推送
```bash
git push
```

## 当前仓库远端
```text
git@github.com:Sjeary/singbox-client.git
```

## 备注
- 当前仓库已经推送到远端 `main`
- 如果在新设备上使用 SSH 推送，需要先完成 GitHub SSH key 配置
