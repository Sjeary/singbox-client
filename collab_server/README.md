# 协作通信服务器

本目录提供登录认证、在线状态、实时聊天服务端程序，用于桌面端“协作通信”模块。

## 功能
- 账号密码登录
- 在线成员列表同步
- 在线状态下实时聊天（WebSocket）
- 网段全体聊天室 + 在线私聊
- 头像资料同步与在线展示
- 账号由服务器持有者创建与维护

## 环境要求
- Node.js 20+

## 安装
```bash
npm install
```

## 创建账号
```bash
node add_user.js <username> <password>
```

可选头像：
```bash
node add_user.js <username> <password> "🧪"
```

示例：
```bash
node add_user.js admin MyStrongPass123
```

## 启动服务器
```bash
npm start
```

默认监听：`0.0.0.0:8088`

可用环境变量：
- `PORT`：监听端口，默认 `8088`
- `HOST`：监听地址，默认 `0.0.0.0`
- `USERS_FILE`：用户文件路径，默认 `./data/users.json`
- `SESSION_TTL_MS`：会话有效期（毫秒），默认 24 小时
- `HISTORY_MAX`：聊天历史缓存条数，默认 200

## 与客户端对接
在桌面客户端“协作通信”填写：
- 服务地址：`http://你的公网IP:8088`
- 账号：通过 `add_user.js` 创建
- 密码：创建时设置

登录成功后会自动建立 WebSocket 连接。连接在线时才允许发送消息。

## 公网服务器部署建议（Linux）
### 你需要复制到 Ubuntu 的内容
建议直接复制整个 `collab_server/` 目录（最省心）。

如果只复制最小集合，需要这些文件：
- `server.js`
- `add_user.js`
- `package.json`
- `package-lock.json`
- `data/users.json`

### Ubuntu 一键部署（推荐）
先把 `collab_server/` 上传到服务器任意目录（例如 `/root/collab_server`），然后执行：

```bash
cd /root/collab_server
chmod +x deploy_ubuntu.sh
sudo ./deploy_ubuntu.sh
```

部署完成后创建账号：

```bash
cd /opt/singbox-collab
sudo -u singbox node add_user.js <user> <password>
```

默认会：
- 安装 Node.js 20（若缺失或版本低于 20）
- 将程序同步到 `/opt/singbox-collab`
- 注册并启动 `systemd` 服务 `singbox-collab`
- 放行 `8088/tcp`（若启用 `ufw`）

### Ubuntu 手工部署（可选）
```bash
sudo apt-get update
sudo apt-get install -y nodejs npm
cd /opt/singbox-collab
npm install --omit=dev
node add_user.js <user> <password>
PORT=8088 HOST=0.0.0.0 npm start
```

### systemd 常用命令
```bash
sudo systemctl status singbox-collab
sudo systemctl restart singbox-collab
sudo journalctl -u singbox-collab -f
```

## 健康检查
```bash
curl http://127.0.0.1:8088/api/health
```

## 客户端填写
- 服务地址：`http://你的Ubuntu公网IP:8088`
- 账号密码：使用 `add_user.js` 创建
