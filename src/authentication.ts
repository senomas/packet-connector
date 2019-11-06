import { AuthenticationError } from "apollo-server-core";
import * as jwt from "jsonwebtoken";
import { ForbiddenError } from "type-graphql";

import { config } from "./config";
import { logger } from "./services/service";

export async function getUser(req) {
  let token;
  if (req.headers) {
    token = req.headers["x-access-token"] || req.headers.authorization;
  } else {
    token = req;
  }
  if (token && token !== "") {
    if (token.startsWith("Bearer ")) {
      token = token.slice(7, token.length);
    }
    return await parseToken(token);
  }
  return null;
}

export async function parseToken(token) {
  let header;
  try {
    header = JSON.parse(
      Buffer.from(token.split(".")[0], "base64").toString("utf8")
    );
  } catch (err) {
    logger.error({ token, err }, "invalid token header");
    throw new AuthenticationError("InvalidTokenHeader");
  }
  const keyid = header.kid;
  if (!(config.keys[keyid] && config.keys[keyid].key)) {
    throw new AuthenticationError("UnknownKeyID");
  }
  try {
    return jwt.verify(token, config.keys[keyid].key);
  } catch (err) {
    logger.error({ header, token, err }, "invalid token");
    if (err && err.name === "TokenExpiredError") {
      throw new AuthenticationError("TokenExpiredError");
    } else {
      throw new AuthenticationError("InvalidToken");
    }
  }
}
