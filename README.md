# MQTT Server

MQTT 消息推送服务，提供 Web 管理界面用于连接 MQTT Broker、发布/订阅消息、管理 Topic。

## 功能特性

- MQTT Broker 连接管理（支持多配置持久化）
- 消息发布（支持 QoS、Retain）
- 消息订阅与实时接收（WebSocket 推送）
- Topic 本地管理（增删改查、标签备注）
- 消息历史记录
- 连接配置管理（多环境切换）

## 环境要求

- Node.js >= 16

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置连接

有两种方式配置连接：

**方式一：通过 Web 界面（推荐）**

启动服务后访问 http://localhost:3000，在「连接配置」区域填写 Broker 地址、用户名、密码，点击「连接」。连接成功后配置会自动保存到 `connections.json`。

**方式二：手动编辑配置文件**

复制 `connections.json.example` 为 `connections.json` 并编辑：

```bash
cp connections.json.example connections.json
```

`connections.json` 格式示例：

```json
[
  {
    "id": 1,
    "brokerUrl": "tcp://your-broker-address:1883",
    "username": "your-username",
    "password": "your-password",
    "clientId": "jgc-push-server",
    "tag": "生产环境"
  },
  {
    "id": 2,
    "brokerUrl": "tcp://test-broker-address:1883",
    "username": "test-username",
    "password": "test-password",
    "clientId": "jgc-push-server",
    "tag": "测试环境"
  }
]
```

字段说明：
- `id` - 唯一标识（建议使用时间戳）
- `brokerUrl` - MQTT Broker 地址
- `username` - 用户名（可选）
- `password` - 密码（可选）
- `clientId` - 客户端 ID（可选，默认 `jgc-push-server`）
- `tag` - 标签备注（用于区分不同环境）

**注意：** 手动配置时无需填写 `lastConnected`，该字段由系统自动维护。服务启动时会默认连接数组中的第一个配置。

### 3. 启动服务

```bash
npm start
```

启动后访问 http://localhost:3000 打开 Web 管理界面。

服务启动时会自动连接：
- 如果 `connections.json` 中有配置，会选择数组中的第一个配置自动连接
- 如果 `connections.json` 为空或不存在，不会自动连接，需要在 Web 界面手动配置
- 通过 Web 界面连接后，系统会自动记录连接时间，下次启动时优先使用最近连接的配置

### 4. 停止/重启服务

```bash
npm stop      # 停止服务
npm restart   # 重启服务
```

## 项目结构

```
mqtt-server/
├── src/
│   ├── server.js        # 主服务（Express + Socket.IO + MQTT）
│   ├── mqtt-client.js   # MQTT 客户端封装
│   ├── stop.js          # 停止脚本
│   └── restart.js       # 重启脚本
├── public/
│   └── index.html       # Web 管理界面
├── .env                 # 服务器配置（不提交到 git）
├── connections.json     # MQTT 连接配置（不提交到 git）
├── connections.json.example  # 连接配置示例模板
├── topics.json          # Topic 本地缓存（不提交到 git）
└── package.json
```

## 配置说明

### .env 文件

服务器基础配置。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `WEB_PORT` | Web 服务端口 | `3000` |

### connections.json 文件

保存 MQTT 连接配置，支持在 Web 界面中切换不同环境的连接。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 唯一标识（建议使用时间戳） |
| `brokerUrl` | string | MQTT Broker 地址 |
| `username` | string | 用户名（可选） |
| `password` | string | 密码（可选） |
| `clientId` | string | 客户端 ID（可选） |
| `tag` | string | 标签备注（用于区分环境） |
| `lastConnected` | string | 最后连接时间（系统自动维护，无需手动填写） |
