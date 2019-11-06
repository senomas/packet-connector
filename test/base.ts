import "mocha";
import * as bunyan from "bunyan";
import { expect } from "chai";
import crypto from "crypto";
import chai = require("chai");
import chaiHttp = require("chai-http");
import fs = require("fs");
import yaml = require("js-yaml");
import { DocumentNode } from "graphql";
const { print: printGql } = require('graphql/language/printer');

chai.use(chaiHttp);

export const values = {} as any;
export const config = yaml.safeLoad(fs.readFileSync("config.yaml").toString());

const ecdh = crypto.createECDH(this.config.auth.curves);
ecdh.generateKeys();

if (fs.existsSync("module.yaml")) {
  const gmods = yaml.safeLoad(fs.readFileSync("module.yaml").toString());
  Object.entries(gmods).forEach((v: any) => {
    if (v[1].subs) {
      this.config.modules[v[0]] = v[1].subs;
    }
  });
}

if (config.logger && config.logger.path) {
  const dir = process.env.LOGGER_PATH || config.logger.path || ".";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

export const logger = bunyan.createLogger(
  config.logger && config.logger.path
    ? {
      name: "test",
      streams: [
        {
          type: "rotating-file",
          ...config.logger,
          path: `${process.env.LOGGER_PATH ||
            config.logger.path ||
            "."}/test.log`
        }
      ]
    }
    : { name: "test" }
);

export class BaseTest {
  protected http = (chai as any).request(process.env.TEST_SERVER);
  protected config: any = config;

  public async post(data: any, { token } = { token: values.token }) {
    const req = this.http.post("/graphql");
    if (token) {
      req.set("Authorization", `Bearer ${token}`);
    }
    const res = await req.send(data);
    logger.info({ res, body: res.body }, "post");
    res.log = `${res.request.method} ${res.request.url} ${JSON.stringify(
      res.body,
      undefined,
      2
    )}`;
    return res;
  }

  public async postMutation(query: DocumentNode, { token } = { token: values.token }) {
    const req = this.http.post("/graphql");
    if (token) {
      req.set("Authorization", `Bearer ${token}`);
    }
    const res = await req.send({ mutation: printGql(query) });
    logger.info({ res, body: res.body }, "post");
    res.log = `${res.request.method} ${res.request.url} ${JSON.stringify(
      res.body,
      undefined,
      2
    )}`;
    return res;
  }
}
