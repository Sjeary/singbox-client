# SingBox 桌面控制台（Electron）

本目录提供基于 Electron 的桌面控制程序，用于统一管理发送端与接收端服务。

## 功能说明
- 支持发送端与接收端统一控制界面
- 支持发送端独立程序与接收端独立程序
- 支持服务一键启动、停止与运行日志查看
- 自动保存参数并在运行时生成配置文件
- Windows 支持便携式单文件分发
- 内置协作通信界面（登录、在线成员、实时聊天）

## 运行环境
- Node.js 20+（包含 npm）

安装依赖：

```bash
npm install
```

## 开发启动
- 统一界面模式：

```bash
npm run dev
```

- 发送端模式：

```bash
npm run dev:sender
```

- 接收端模式：

```bash
npm run dev:receiver
```

## Windows 打包
- 统一界面便携包：

```bash
npm run dist:win
```

- 发送端便携包：

```bash
npm run dist:win:sender
```

- 接收端便携包：

```bash
npm run dist:win:receiver
```

- 同时构建发送端与接收端：

```bash
npm run dist:win:split
```

输出目录：
- 统一界面：`release/`
- 发送端：`release_sender/`
- 接收端：`release_receiver/`

## 脚本入口（Windows）
- `start_dev_windows.bat`
- `build_win_portable.bat`
- `build_win_sender.bat`
- `build_win_receiver.bat`
- `build_win_split.bat`

## 发送端模式约束
- 发送端独立模式下，目标域名使用内置默认集合，不提供编辑入口。

## 二进制准备规则
打包前会执行 `prepare:assets`，按优先级自动准备可执行文件：
1. `v2/assets/<platform>/`
2. Windows 兜底：根目录 `sing-box.exe` 与 `frp_0.65.0_windows_amd64/frpc.exe`

## 协作通信服务器
- 服务端目录：`collab_server/`
- 用于账号认证、在线状态同步与聊天广播
- 快速启动：

```bash
cd collab_server
npm install
node add_user.js admin MyStrongPass123
npm start
```

客户端服务地址示例：`http://你的公网IP:8088`
