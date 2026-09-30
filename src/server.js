require('dotenv').config();
const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const MqttClientManager = require('./mqtt-client');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const mqttManager = new MqttClientManager();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/status', (req, res) => {
  res.json(mqttManager.getConnectionInfo());
});

app.get('/api/messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(mqttManager.getReceivedMessages(limit));
});

app.post('/api/connect', (req, res) => {
  const { brokerUrl, username, password, clientId } = req.body;
  if (!brokerUrl) {
    return res.status(400).json({ error: 'brokerUrl 必填' });
  }
  try {
    mqttManager.disconnect();
    mqttManager.connect({ brokerUrl, username, password, clientId });
    res.json({ success: true, message: '正在连接...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/publish', async (req, res) => {
  const { topic, message, qos = 0, retain = false } = req.body;
  if (!topic || message === undefined) {
    return res.status(400).json({ error: 'topic 和 message 必填' });
  }
  try {
    await mqttManager.publish(topic, String(message), qos, retain);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscribe', (req, res) => {
  const { topic, qos = 0 } = req.body;
  if (!topic) {
    return res.status(400).json({ error: 'topic 必填' });
  }
  try {
    mqttManager.subscribe(topic, qos);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/unsubscribe', (req, res) => {
  const { topic } = req.body;
  if (!topic) {
    return res.status(400).json({ error: 'topic 必填' });
  }
  try {
    mqttManager.unsubscribe(topic);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/disconnect', (req, res) => {
  mqttManager.disconnect();
  res.json({ success: true });
});

// Socket.IO - 实时推送 MQTT 事件到前端
io.on('connection', (socket) => {
  socket.emit('status', { connected: mqttManager.connected });
});

mqttManager.on('status', (data) => {
  io.emit('status', data);
});

mqttManager.on('message', (msg) => {
  io.emit('message', msg);
});

mqttManager.on('error', (errMsg) => {
  io.emit('error', errMsg);
});

// 启动时自动连接 .env 中的配置
const PORT = process.env.WEB_PORT || 3000;
if (process.env.MQTT_BROKER_URL && process.env.MQTT_BROKER_URL !== 'tcp://your-broker-address:1883') {
  mqttManager.connect({
    brokerUrl: process.env.MQTT_BROKER_URL,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId: process.env.MQTT_CLIENT_ID,
  });
}

httpServer.listen(PORT, () => {
  console.log(`Web 管理界面: http://localhost:${PORT}`);
});
