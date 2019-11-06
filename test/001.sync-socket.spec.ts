import "mocha";
import { expect } from "chai";
import { suite, test } from "mocha-typescript";
import { createServer } from "net";

import { BaseTest, values, logger } from "./base";

@suite
export class SyncSocketTest extends BaseTest {
  static server = null;

  static async before() {
    SyncSocketTest.server = createServer(socket => {
      const client = `${socket.remoteAddress}:${socket.remotePort}`;
      logger.info({ client }, "CONNECTION");
      socket.on('data', data => {
        logger.info({ client, data }, "RECV");
        setTimeout(() => {
          socket.write(data);
        }, 1000);
      });
      socket.on('close', data => {
        logger.info({ client, data }, "CLOSE");
      });
    }).listen(9000, "0.0.0.0");
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  static after() {
    SyncSocketTest.server.close();
  }

  @test
  public async openChannelNoServer() {
    const res = await this.post({
      query: `mutation open($target: String!) {
        open(target: $target) {
          target
          channelKey
        }
      }`,
      variables: {
        target: "noserver"
      }
    });
    expect(res.status, res.log).to.eql(200);
    expect(res.body, res.log).to.haveOwnProperty("errors");
    expect(res.body.errors[0].message, res.log).to.eql("connect ECONNREFUSED 127.0.0.1:9999");
  }


  @test
  public async openChannel() {
    const res = await this.post({
      query: `mutation open($target: String!) {
        open(target: $target) {
          target
          channelKey
        }
      }`,
      variables: {
        target: "core"
      }
    });
    expect(res.status, res.log).to.eql(200);
    expect(res.body, res.log).to.not.haveOwnProperty("errors");
    values.channel = res.body.data.open;
  }

  @test
  public async sendMessage() {
    const res = await this.post({
      query: `mutation sendMesssage($channel: ChannelInput!, $message: String!, $timeout: Int!) {
        send(channel: $channel, message: $message, timeout: $timeout) {
          source
          time
          correlationKey
          raw
        }
      }`,
      variables: {
        channel: values.channel,
        message: "data 1\ndata 2\nfoo",
        timeout: 3000
      }
    });
    expect(res.status, res.log).to.eql(200);
    expect(res.body, res.log).to.not.haveOwnProperty("errors");
    expect(res.body.data.send.map(v => v.raw), res.log).to.eql(["data 1", "data 2"]);
  }

  @test
  public async sendMessage2() {
    const res = await this.post({
      query: `mutation sendMesssage($channel: ChannelInput!, $message: String!, $timeout: Int!) {
        send(channel: $channel, message: $message, timeout: $timeout) {
          source
          time
          correlationKey
          raw
        }
      }`,
      variables: {
        channel: values.channel,
        message: "data 3\n",
        timeout: 0
      }
    });
    expect(res.status, res.log).to.eql(200);
    expect(res.body, res.log).to.not.haveOwnProperty("errors");
    expect(res.body.data.send.length, res.log).to.eql(0);
  }

  @test
  public async retreiveMessage() {
    const res = await this.post({
      query: `query retrieveMessage($channel: ChannelInput!, $timeout: Int!) {
        retrieve(channel: $channel, timeout: $timeout) {
          source
          correlationKey
          raw
        }
      }`,
      variables: {
        channel: values.channel,
        timeout: 3000
      }
    });
    expect(res.status, res.log).to.eql(200);
    expect(res.body, res.log).to.not.haveOwnProperty("errors");
    expect(res.body.data, res.log).to.haveOwnProperty("retrieve");
    expect(res.body.data.retrieve.map(v => v.raw), res.log).to.eql(["foodata 3"]);
  }

  @test
  public async closeChannel() {
    const res = await this.post({
      query: `mutation close($channel: ChannelInput!) {
        close(channel: $channel)
      }`,
      variables: {
        channel: values.channel
      }
    });
    expect(res.status, res.log).to.eql(200);
    expect(res.body, res.log).to.not.haveOwnProperty("errors");
    values.channel = res.body.data.open;
  }
}
