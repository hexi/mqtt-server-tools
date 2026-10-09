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
const SENT_MESSAGES_FILE = path.join(__dirname, '..', 'sent-messages.json');
const CONNECTIONS_FILE = path.join(__dirname, '..', 'connections.json');
const MAX_SENT_MESSAGES = 200;

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

function loadSentMessages() {
  try {
    if (fs.existsSync(SENT_MESSAGES_FILE)) {
      const data = fs.readFileSync(SENT_MESSAGES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[SentMessages] 加载失败:', err.message);
  }
  return [];
}

function saveSentMessage(msg) {
  try {
    const messages = loadSentMessages();
    messages.unshift({
      ...msg,
      id: Date.now(),
      timestamp: new Date().toISOString(),
    });
    if (messages.length > MAX_SENT_MESSAGES) {
      messages.length = MAX_SENT_MESSAGES;
    }
    fs.writeFileSync(SENT_MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
  } catch (err) {
    console.error('[SentMessages] 保存失败:', err.message);
  }
}

function loadConnections() {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) {
      const data = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Connections] 加载失败:', err.message);
  }
  return [];
}

function saveConnections(connections) {
  try {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2), 'utf8');
  } catch (err) {
    console.error('[Connections] 保存失败:', err.message);
  }
}

function saveConnection(config) {
  const connections = loadConnections();
  const existing = connections.find(c => c.brokerUrl === config.brokerUrl && c.username === config.username);
  if (existing) {
    existing.clientId = config.clientId;
    existing.password = config.password;
    existing.lastConnected = new Date().toISOString();
  } else {
    connections.push({
      id: Date.now(),
      brokerUrl: config.brokerUrl,
      username: config.username || '',
      password: config.password || '',
      clientId: config.clientId || 'jgc-push-server',
      tag: '',
      lastConnected: new Date().toISOString(),
    });
  }
  saveConnections(connections);
}

app.use(express.json());
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
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
    saveConnection({ brokerUrl, username, password, clientId });
    res.json({ success: true, message: '正在连接...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/connections', (req, res) => {
  res.json(loadConnections());
});

app.put('/api/connections/:id', (req, res) => {
  const { id } = req.params;
  const { tag } = req.body;
  const connections = loadConnections();
  const conn = connections.find(c => c.id === parseInt(id));
  if (conn) {
    conn.tag = tag !== undefined ? tag : conn.tag;
    saveConnections(connections);
  }
  res.json({ success: true, connections });
});

app.delete('/api/connections/:id', (req, res) => {
  const { id } = req.params;
  let connections = loadConnections();
  connections = connections.filter(c => c.id !== parseInt(id));
  saveConnections(connections);
  res.json({ success: true, connections });
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
    saveSentMessage({ topic, message: String(message), qos, retain });
    res.json({ success: true });
  } catch (err) {
    console.error(`[API] publish 失败: topic=${topic}, error=${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sent-messages', (req, res) => {
  const { search } = req.query;
  let messages = loadSentMessages();
  if (search) {
    const keyword = search.toLowerCase();
    messages = messages.filter(m =>
      m.topic.toLowerCase().includes(keyword) ||
      m.message.toLowerCase().includes(keyword)
    );
  }
  res.json(messages);
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
  socket.emit('status', mqttManager.getConnectionInfo());
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

// 启动时自动连接：使用 connections.json 中上次连接成功的配置
const PORT = process.env.WEB_PORT || 3000;
const connections = loadConnections();
if (connections.length > 0) {
  // 按 lastConnected 降序排序，如果相同则按 id 升序（确保数组第一个优先）
  const last = connections.sort((a, b) => {
    const timeDiff = new Date(b.lastConnected) - new Date(a.lastConnected);
    if (timeDiff !== 0) return timeDiff;
    return a.id - b.id;
  })[0];
  console.log(`[AutoConnect] 使用连接配置: ${last.brokerUrl} (${last.username || '无用户名'})`);
  mqttManager.connect({
    brokerUrl: last.brokerUrl,
    username: last.username,
    password: last.password,
    clientId: last.clientId,
  });
}

httpServer.listen(PORT, () => {
  console.log(`Web 管理界面: http://localhost:${PORT}`);
});
