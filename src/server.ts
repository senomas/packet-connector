import smap = require("source-map-support");
import 'reflect-metadata';
import { ApolloServer } from 'apollo-server-express';
import shrinkRay from 'shrink-ray-current';
import express from 'express';
import { buildSchema, MiddlewareFn } from 'type-graphql';
import fs = require("fs");
import path = require("path");

import { getUser } from './authentication';
import { customAuthChecker } from './authorization';
import { config } from './config';
import { SocketResolver } from './resolvers/socket';
import { logger, NODE_ENV } from './services/service';
smap.install();


export const ResolveTime: MiddlewareFn = async ({ info }, next) => {
  const start = Date.now();
  await next();
  const responseTime = Date.now() - start;
  logger.info({ path: `${info.parentType.name}.${info.fieldName}`, responseTime }, 'resolve time');
};

class BasicLogging {
  public requestDidStart(o) {
    logger.info({ query: o.queryString, variables: o.variables }, 'graphql request');
  }

  public willSendResponse({ graphqlResponse }) {
    logger.info({ gqlRes: graphqlResponse }, 'graphql response');
  }
}

export async function bootstrap() {
  const schema = await buildSchema({
    resolvers: [SocketResolver],
    authChecker: customAuthChecker,
    authMode: "null",
    emitSchemaFile: true,
    dateScalarMode: "isoDate"
  });

  const server = new ApolloServer({
    schema,
    playground: true,
    formatError: err => {
      if (err.message && err.message.startsWith("Context creation failed: ")) {
        err.message = err.message.substr(25);
      }
      return err;
    },
    context: async ({ req }) => {
      const user = await getUser(req);
      const remoteAddress = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      return { user, headers: req.headers, remoteAddress };
    },
    extensions: [() => {
      return new BasicLogging();
    }]
  });

  const app = express();
  app.use(shrinkRay());
  server.applyMiddleware({ app });

  const port = parseInt(process.env.PORT, 10 || 4000);
  const bindAddress = process.env.BIND_ADDRESS || "0.0.0.0";
  const serverInfo = await app.listen(port, bindAddress);
  logger.info({ port, bindAddress, ...serverInfo }, "Server is running");
}

bootstrap().catch(err => {
  console.error("server error", err);
  process.exit(-1);
});
