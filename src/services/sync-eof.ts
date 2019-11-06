import { Socket } from "net";
import { EventEmitter } from "events";

import { Channel, Message } from "../schemas/socket";

import { ChannelService, logger, channels } from "./service";

export class SyncEOF implements ChannelService {
  public target: string = null;
  public source: string = null;
  public channelKey: string = null;

  private time: Date = null;
  private socket = null;
  private buffer: Buffer = null;
  private messages: Message[] = null;

  private events = new EventEmitter();

  constructor(private opt) {
  }

  public async connect(target: string): Promise<Channel> {
    this.target = target;
    return new Promise((resolve, reject) => {
      this.socket = new Socket();
      this.socket.connect(this.opt.port, this.opt.host);
      logger.info({ opt: this.opt }, "CONNECT");
      this.socket.on('connect', () => {
        logger.info({
          remoteAddress: this.socket.remoteAddress,
          remotePort: this.socket.remotePort,
          localPort: this.socket.localPort
        }, "CONNECTED");
        this.source = `${this.socket.remoteAddress}:${this.socket.remotePort}`;
        this.channelKey = `${this.socket.localPort}:${this.socket.remoteAddress}:${this.socket.remotePort}`;
        this.buffer = Buffer.from([]);
        this.messages = [];
        this.time = new Date();
        channels[this.channelKey] = this;
        resolve({
          target,
          channelKey: this.channelKey
        });
      });
      this.socket.on('data', (data: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, data], this.buffer.length + data.length);
        let ix = this.buffer.indexOf(this.opt.eof);
        while (ix >= 0) {
          this.messages.push({
            source: this.source,
            time: this.time,
            raw: this.buffer.slice(0, ix).toString(this.opt.encoding || 'utf8')
          });
          this.buffer = this.buffer.slice(ix + 1);
          ix = this.buffer.indexOf(this.opt.eof);
        }
        this.time = new Date();
        if (this.messages.length > 0) {
          this.events.emit('message');
        }
        logger.info({ channelKey: this.channelKey, buffer: this.buffer, messages: this.messages }, 'RECV');
      });
      this.socket.on('error', err => {
        logger.info({ channelKey: this.channelKey, err }, "ERROR");
        reject(err);
      });
      this.socket.on('end', () => {
        logger.info({ channelKey: this.channelKey }, "CLOSED");
        delete channels[this.channelKey];
      });
    });
  }

  public async write(data: string): Promise<void> {
    await new Promise(resolve => this.socket.write(data, resolve));
  }

  public async read(timeout: number): Promise<Message[]> {
    if (this.messages.length > 0) {
      const res = this.messages;
      this.messages = [];
      return res;
    }
    if (timeout > 0) {
      logger.info("READ", { timeout });
      return await new Promise(resolve => {
        let cbt;
        const retr = data => {
          logger.info("READ-EVENT", { data, messsages: this.messages });
          if (cbt) {
            clearTimeout(cbt);
          }
          if (this.messages.length > 0) {
            const res = this.messages;
            this.messages = [];
            return resolve(res);
          }
          resolve(null);
        };
        this.events.once('message', retr);
        cbt = setTimeout(() => {
          logger.info("READ-TIMEOUT");
          this.events.removeListener('message', retr);
          resolve([]);
        }, timeout);
        logger.info("READ-END");
      });
    }
    return [];
  }

  public async end(): Promise<void> {
    await new Promise(resolve => this.socket.end(resolve));
  }
}
