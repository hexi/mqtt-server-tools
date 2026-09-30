require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const MqttClientManager = require('./mqtt-client');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const mqttManager = new MqttClientManager();

const TOPICS_FILE = path.join(__dirname, '..', 'topics.json');

function loadTopics() {
  try {
    if (fs.existsSync(TOPICS_FILE)) {
      const data = fs.readFileSync(TOPICS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return parsed.map(t => ({ topic: t, tag: '' }));
      }
      return parsed;
    }
  } catch (err) {
    console.error('[Topics] 加载失败:', err.message);
  }
  return [];
}

function saveTopics(topics) {
  try {
    fs.writeFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2), 'utf8');
  } catch (err) {
    console.error('[Topics] 保存失败:', err.message);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/status', (req, res) => {
  res.json(mqttManager.getConnectionInfo());
});

app.get('/api/topics', (req, res) => {
  res.json(loadTopics());
});

app.post('/api/topics', (req, res) => {
  const { topic, tag = '' } = req.body;
  if (!topic) return res.json({ success: false, error: 'topic 必填' });
  const topics = loadTopics();
  if (topics.find(t => t.topic === topic)) {
    return res.json({ success: false, error: '此 Topic 已存在' });
  }
  topics.push({ topic, tag });
  saveTopics(topics);
  res.json({ success: true, topics });
});

app.put('/api/topics', (req, res) => {
  const { topic, tag } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic 必填' });
  const topics = loadTopics();
  const entry = topics.find(t => t.topic === topic);
  if (entry) {
    entry.tag = tag !== undefined ? tag : entry.tag;
    saveTopics(topics);
  }
  res.json({ success: true, topics });
});

app.delete('/api/topics', (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic 必填' });
  let topics = loadTopics();
  topics = topics.filter(t => t.topic !== topic);
  saveTopics(topics);
  res.json({ success: true, topics });
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
  console.log(`[API] publish 请求: topic=${topic}, qos=${qos}, retain=${retain}, username=${mqttManager.username}, connected=${mqttManager.connected}`);
  console.log(`[API] 消息内容: ${message}`);
  try {
    await mqttManager.publish(topic, String(message), qos, retain);
    console.log(`[API] publish 成功: topic=${topic}`);
    const topics = loadTopics();
    if (!topics.find(t => t.topic === topic)) {
      topics.push({ topic, tag: '' });
      saveTopics(topics);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(`[API] publish 失败: topic=${topic}, error=${err.message}`);
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
