const { dest, src } = require("gulp");
const shell = require("shelljs");
const { spawn } = require("child_process");
const args = require("yargs").argv;
const gitlog = require("gitlog");
const fs = require("fs");
const netstat = require('node-netstat');

async function tsc() {
  await shell.exec("npx tsc -p tsconfig.build.json", {
    async: false
  });
}

async function build() {
  await tsc();
  await copyData();
  const commits = gitlog({
    repo: ".",
    number: 10,
    fields: ["hash", "abbrevHash", "subject", "authorName", "authorDate"]
  });
  fs.writeFileSync(
    "dist/build.json",
    JSON.stringify({ buildTime: new Date(), commits })
  );
}

async function copyData() {
  await new Promise(resolve => {
    src("src/data/*.{json,yaml}")
      .pipe(dest("dist/data"))
      .on("end", resolve);
  });
}

async function dockerUp() {
  await shell.exec("docker-compose -p micro-ql up -d", {
    async: false,
    cwd: "../account"
  });
}

async function dockerDown() {
  await shell.exec("docker-compose -p micro-ql down", {
    async: false,
    cwd: "../account"
  });
}

async function kill() {
  await killPorts([5000])
}

async function run() {
  await dockerUp();
  await build();
  await shell.exec("node dist/server.js", {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "development",
      PORT: 5000
    },
    async: false
  });
}

async function killPorts(ports) {
  const res = {};
  await new Promise((resolve, reject) => {
    netstat({
      filter: {
        state: 'LISTEN'
      },
      done: (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      }
    }, data => {
      res[data.local.port] = data;
    })
  })
  for (port of ports) {
    if (res[port]) {
      console.log(`kill ${res[port].pid}`);
      await shell.exec(`kill ${res[port].pid}`, {
        async: false
      });
    }
  }
}

async function waitPorts(ports) {
  const expiry = Date.now() + 90000;
  while (true) {
    let res = [];
    await new Promise((resolve, reject) => {
      netstat({
        filter: {
          state: 'LISTEN'
        },
        done: (err) => {
          if (err) {
            return reject(err)
          }
          resolve()
        }
      }, data => {
        res.push(data);
      })
    })
    res = res.filter(data => ports.indexOf(data.local.port) >= 0);
    if (res.length === ports.length) {
      return
    }
    if (expiry < Date.now()) {
      throw `port not ready ${res.map(data => data.local.port)}`
    }
  }
}

async function fix() {
  await shell.exec("tslint --fix --project .", {
    async: false
  });
}
async function test() {
  await fix();
  await kill();
  await shell.exec("rm -rf log dist", {
    async: false
  });
  await build();
  await dockerUp();
  const proc = spawn("node", ["dist/server.js"], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      PORT: 5000
    }
  });
  proc.stdout.pipe(process.stdout);
  proc.stderr.pipe(process.stderr);
  console.log("waiting server...");
  await waitPorts([5000])
  console.log(
    `npx mocha -r ts-node/register ${
    args.bail ? "-b" : ""
    } --color -t 90000 test/**/*${args.mod ? `${args.mod}*` : ""}.spec.ts`
  );
  shell.exec(
    `npx mocha -r ts-node/register  ${
    args.bail ? "-b" : ""
    } --color -t 90000 test/**/*${args.mod ? `${args.mod}*` : ""}.spec.ts`,
    {
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        TEST_SERVER: `http://localhost:5000`
      },
      async: false
    }
  );
  proc.kill();
}

module.exports = {
  fix,
  tsc,
  copyData,
  build,
  dockerUp,
  dockerDown,
  run,
  kill,
  test
};
