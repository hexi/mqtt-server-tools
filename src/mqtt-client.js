const mqtt = require('mqtt');
const { EventEmitter } = require('events');

class MqttClientManager extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.receivedMessages = [];
    this.maxMessages = 200;
    this.lastError = null;
    this.brokerUrl = null;
    this.username = null;
    this.clientId = null;
  }

  connect(options) {
    if (this.client) {
      this.client.end(true);
    }

    this.subscriptions.clear();
    this.receivedMessages = [];
    this.lastError = null;
    this.brokerUrl = options.brokerUrl;
    this.username = options.username || null;
    this.clientId = options.clientId || `mqtt-web-${Date.now()}`;

    const connectOptions = {
      username: options.username || undefined,
      password: options.password || undefined,
      clientId: options.clientId || `mqtt-web-${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    };

    console.log(`[MQTT] 正在连接 ${options.brokerUrl} ...`);
    this.client = mqtt.connect(options.brokerUrl, connectOptions);

    this.client.on('connect', () => {
      this.connected = true;
      this.lastError = null;
      console.log('[MQTT] 连接成功');
      this.emit('status', { connected: true, brokerUrl: options.brokerUrl, clientId: this.clientId });

      for (const [topic, sub] of this.subscriptions) {
        if (!sub.active) {
          this.client.subscribe(topic, { qos: sub.qos });
          sub.active = true;
        }
      }
    });

    this.client.on('message', (topic, payload, packet) => {
      const msg = {
        topic,
        payload: payload.toString(),
        qos: packet.qos,
        retain: packet.retain,
        timestamp: new Date().toISOString(),
      };
      this.receivedMessages.unshift(msg);
      if (this.receivedMessages.length > this.maxMessages) {
        this.receivedMessages.pop();
      }
      this.emit('message', msg);
    });

    this.client.on('offline', () => {
      this.connected = false;
      console.log('[MQTT] 离线');
      this.emit('status', { connected: false });
    });

    this.client.on('error', (err) => {
      this.lastError = err.message;
      console.error('[MQTT] 错误:', err.message);
      this.emit('error', err.message);
    });

    this.client.on('reconnect', () => {
      console.log('[MQTT] 重连中...');
      this.emit('status', { connected: false, reconnecting: true });
    });

    this.client.on('close', () => {
      this.connected = false;
      console.log('[MQTT] 连接关闭');
    });
  }

  publish(topic, message, qos = 0, retain = false) {
    if (!this.connected) {
      throw new Error('MQTT 未连接');
    }
    console.log(`[MQTT] 准备发布: topic=${topic}, qos=${qos}, retain=${retain}, username=${this.username}, clientId=${this.client?.options?.clientId}`);
    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, { qos, retain }, (err) => {
        if (err) {
          console.error(`[MQTT] 发布失败 topic=${topic}:`, err.message);
          reject(err);
        } else {
          console.log(`[MQTT] 发布成功 topic=${topic} qos=${qos} len=${message.length}`);
          resolve();
        }
      });
    });
  }

  subscribe(topic, qos = 0) {
    if (!this.client) {
      throw new Error('MQTT 客户端未初始化');
    }
    this.subscriptions.set(topic, { qos, active: true });
    this.client.subscribe(topic, { qos }, (err, granted) => {
      if (err) {
        console.error(`[MQTT] 订阅失败 topic=${topic}:`, err.message);
        this.lastError = `订阅 ${topic} 失败: ${err.message}`;
      } else {
        console.log(`[MQTT] 已订阅 topic=${topic} qos=${granted?.[0]?.qos ?? qos}`);
      }
    });
  }

  unsubscribe(topic) {
    if (!this.client) return;
    this.subscriptions.delete(topic);
    this.client.unsubscribe(topic);
  }

  getSubscriptions() {
    return Array.from(this.subscriptions.entries()).map(([topic, info]) => ({
      topic,
      qos: info.qos,
      active: info.active,
    }));
  }

  getReceivedMessages(limit = 50) {
    return this.receivedMessages.slice(0, limit);
  }

  getConnectionInfo() {
    return {
      connected: this.connected,
      brokerUrl: this.brokerUrl,
      username: this.username,
      clientId: this.clientId,
      lastError: this.lastError,
      subscriptions: this.getSubscriptions(),
    };
  }

  disconnect() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      this.connected = false;
      this.emit('status', { connected: false });
    }
  }
}

module.exports = MqttClientManager;
