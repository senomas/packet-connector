import * as bunyan from "bunyan";
import crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import { ApolloError } from "apollo-server-core";

import { config, keyEncoder } from "../config";
import { Channel, ChannelInput, Message } from "../schemas/socket";

import { SyncEOF } from "./sync-eof";

export const NODE_ENV = (process.env.NODE_ENV || "production").toLowerCase();

export const appName = "socket-connector";
if (config.logger && config.logger.path && !fs.existsSync(config.logger.path)) {
  fs.mkdirSync(config.logger.path);
}
const serializers = {
  req: req => {
    if (!req || !req.connection) {
      return req;
    }
    return {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      remoteAddress: req.connection.remoteAddress,
      remotePort: req.connection.remotePort
    };
  },
  res: bunyan.stdSerializers.res,
  err: bunyan.stdSerializers.err
};

export const logger = bunyan.createLogger(
  (config.logger && config.logger.path) ? {
    name: appName,
    serializers,
    streams: [{
      type: "rotating-file",
      ...config.logger,
      path: `${process.env.LOGGER_PATH || config.logger.path || "."}/${appName}-${os.hostname()}.log`,
    }]
  } : { name: appName, serializers });
const raw = Buffer.from(keyEncoder.encodePrivate(config.keys[appName].pkey, "pem", "raw"), "hex").toString("base64");
logger.info({ raw, pem: config.keys[appName].pkey }, "keys");

export const moduleKey = crypto.createECDH(config.auth.curves);
moduleKey.setPrivateKey(raw, "base64");

const targets = config[appName].targets;

export const channels = {};

export interface ChannelService {
  target: string;
  channelKey: string;

  connect(target: string): Promise<Channel>;
  write(data : string): Promise<void>;
  read(timeout: number): Promise<Message[]>;
  end(): Promise<void>;
}

export async function channelOpen(target: string): Promise<Channel> {
  const opt = targets[target];
  if (opt) {
    let channel: ChannelService;
    if (opt.type === 'SyncEOF') {
      channel = new SyncEOF(opt);
    } else {
      throw new ApolloError(`Unsupported type '${opt.type}'`, "UnsupportedType", { opt });
    }
    await channel.connect(target);
    return channel;
  } else {
    throw new ApolloError(`Unknown target '${target}'`, 'UnknownTarget', { target });
  }
}

export async function channelClose(channelInput: ChannelInput): Promise<Boolean> {
  const channel = channels[channelInput.channelKey];
  delete channels[channel.channelKey];
  if (channel) {
    await channel.end();
    return true;
  }
  return false;
}

export async function channelSend(channelInput: ChannelInput, message: string, timeout: number): Promise<Message[]> {
  const channel = channels[channelInput.channelKey];
  if (channel) {
    await channel.write(message);
    return channel.read(timeout);
  }
  throw new ApolloError(`Unknown channel`, "UnknownChannel", channel);
}

export async function channelRetrieve(channelInput: ChannelInput, timeout: number): Promise<Message[]> {
  const channel = channels[channelInput.channelKey];
  if (channel) {
    return channel.read(timeout);
  }
  throw new ApolloError(`Unknown channel`, "UnknownChannel", channel);
}
