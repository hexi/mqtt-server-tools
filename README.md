# MQTT Server

MQTT 消息推送服务，提供 Web 管理界面用于连接 MQTT Broker、发布/订阅消息、管理 Topic。

## 功能特性

- MQTT Broker 连接管理（支持配置持久化）
- 消息发布（支持 QoS、Retain）
- 消息订阅与实时接收（WebSocket 推送）
- Topic 本地管理（增删改查、标签备注）
- 消息历史记录

## 环境要求

- Node.js >= 16

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`（如已存在则直接编辑）：

```bash
# MQTT Broker 连接配置
MQTT_BROKER_URL=tcp://your-broker-address:1883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
MQTT_CLIENT_ID=jgc-push-server

# Web 服务端口
WEB_PORT=3000
```

也可以在 Web 界面中填写连接配置后点击「连接」，配置会自动保存到 `.env` 文件。

### 3. 启动服务

```bash
npm start
```

启动后访问 http://localhost:3000 打开 Web 管理界面。

### 4. 停止/重启服务

```bash
npm stop      # 停止服务
npm restart   # 重启服务
```

## 项目结构

```
mqtt-server/
── src/
│   ├── server.js        # 主服务（Express + Socket.IO + MQTT）
│   ├── mqtt-client.js   # MQTT 客户端封装
│   ├── stop.js          # 停止脚本
│   └── restart.js       # 重启脚本
├── public/
│   └── index.html       # Web 管理界面
├── .env                 # 环境变量配置（不提交到 git）
├── topics.json          # Topic 本地缓存（不提交到 git）
└── package.json
```

## 配置说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MQTT_BROKER_URL` | MQTT Broker 地址 | - |
| `MQTT_USERNAME` | 服务端用户名 | - |
| `MQTT_PASSWORD` | 服务端密码 | - |
| `MQTT_CLIENT_ID` | 客户端 ID | `jgc-push-server` |
| `WEB_PORT` | Web 服务端口 | `3000` |
