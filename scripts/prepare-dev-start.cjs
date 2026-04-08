const { execFileSync } = require("child_process");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const targetPorts = [3000, 4000];
const normalizedRoot = workspaceRoot.toLowerCase();

function run(command, args) {
  return execFileSync(command, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function getWindowsListeners() {
  const script = `
$p = @(3000,4000)
$connections = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalPort, OwningProcess -Unique
if (-not $connections) {
  '[]'
  exit 0
}
$processes = Get-CimInstance Win32_Process |
  Where-Object { $connections.OwningProcess -contains $_.ProcessId } |
  Select-Object ProcessId, Name, CommandLine
$result = foreach ($connection in $connections) {
  $process = $processes | Where-Object { $_.ProcessId -eq $connection.OwningProcess } | Select-Object -First 1
  [PSCustomObject]@{
    port = $connection.LocalPort
    pid = $connection.OwningProcess
    name = $process.Name
    commandLine = $process.CommandLine
  }
}
$result | ConvertTo-Json -Compress
`.trim();

  const output = run("powershell.exe", ["-NoProfile", "-Command", script]);
  if (!output) {
    return [];
  }

  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function getUnixListeners() {
  try {
    const output = run("lsof", ["-nP", "-iTCP:3000,4000", "-sTCP:LISTEN", "-Fpcn"]);
    const rows = [];
    let current = {};

    for (const line of output.split(/\r?\n/)) {
      if (!line) {
        continue;
      }
      const type = line[0];
      const value = line.slice(1);
      if (type === "p") {
        if (current.pid) {
          rows.push(current);
        }
        current = { pid: Number(value) };
      } else if (type === "c") {
        current.name = value;
      } else if (type === "n") {
        const match = value.match(/:(\d+)->?|:(\d+)$/);
        const port = match ? Number(match[1] || match[2]) : undefined;
        current.port = port;
        current.commandLine = current.name;
      }
    }

    if (current.pid) {
      rows.push(current);
    }

    return rows.filter((row) => targetPorts.includes(row.port));
  } catch {
    return [];
  }
}

function getListeners() {
  if (process.platform === "win32") {
    return getWindowsListeners();
  }

  return getUnixListeners();
}

function isWorkspaceProcess(listener) {
  const commandLine = String(listener.commandLine || "").toLowerCase();
  return commandLine.includes(normalizedRoot);
}

function killListener(listener) {
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/PID", String(listener.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }

  process.kill(listener.pid, "SIGTERM");
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function formatListener(listener) {
  const commandLine = String(listener.commandLine || listener.name || "unknown command");
  return `port ${listener.port} (pid ${listener.pid}): ${commandLine}`;
}

function main() {
  const listeners = getListeners().filter((listener) => targetPorts.includes(Number(listener.port)));

  if (listeners.length === 0) {
    console.log("[prepare:dev-start] Ports 3000 and 4000 are free.");
    return;
  }

  const foreignListeners = listeners.filter((listener) => !isWorkspaceProcess(listener));
  if (foreignListeners.length > 0) {
    console.error("[prepare:dev-start] Startup aborted because required dev ports are occupied by external processes:");
    for (const listener of foreignListeners) {
      console.error(`  - ${formatListener(listener)}`);
    }
    console.error("[prepare:dev-start] Stop those processes or change the configured ports before retrying.");
    process.exit(1);
  }

  console.log("[prepare:dev-start] Found stale workspace listeners. Cleaning them up...");
  for (const listener of listeners) {
    console.log(`  - stopping ${formatListener(listener)}`);
    killListener(listener);
  }

  sleep(1200);

  const remaining = getListeners().filter((listener) => targetPorts.includes(Number(listener.port)));
  if (remaining.length > 0) {
    console.error("[prepare:dev-start] Failed to free the required ports:");
    for (const listener of remaining) {
      console.error(`  - ${formatListener(listener)}`);
    }
    process.exit(1);
  }

  console.log("[prepare:dev-start] Ports 3000 and 4000 are ready.");
}

main();
