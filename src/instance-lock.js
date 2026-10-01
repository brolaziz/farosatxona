import {
  mkdirSync,
  openSync,
  writeFileSync,
  readFileSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

function processIdentity(pid) {
  if (process.platform !== "linux") return null;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const startedTicks = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
    const boot = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
    return `${boot}:${startedTicks}`;
  } catch {
    return null;
  }
}

export function acquireInstanceLock(databasePath) {
  const path = resolve(databasePath) + ".lock";
  mkdirSync(dirname(path), { recursive: true });
  let fd;
  try {
    fd = openSync(path, "wx");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const previous = JSON.parse(readFileSync(path, "utf8"));
    if (!Number.isInteger(previous.pid) || previous.pid <= 0)
      throw new Error("Instance lock buzilgan. Operator tekshirsin.");
    let alive = false;
    try {
      process.kill(previous.pid, 0);
      alive = true;
    } catch (err) {
      if (err.code === "EPERM") alive = true;
    }
    // Containers reuse PID 1 after a crash. A live PID alone cannot identify
    // the process that wrote a lock on the persistent volume.
    const identity = processIdentity(previous.pid);
    if (
      alive &&
      previous.identity &&
      identity &&
      previous.identity !== identity
    )
      alive = false;
    if (alive)
      throw new Error(
        "Botning boshqa nusxasi ishlayapti. Bir bazada faqat bitta nusxa ishlating.",
      );
    unlinkSync(path);
    fd = openSync(path, "wx");
  }
  const id = randomUUID();
  try {
    writeFileSync(
      fd,
      JSON.stringify({
        pid: process.pid,
        identity: processIdentity(process.pid),
        id,
        startedAt: new Date().toISOString(),
      }),
    );
  } finally {
    closeSync(fd);
  }
  let released = false;
  return () => {
    if (!released) {
      released = true;
      try {
        if (JSON.parse(readFileSync(path, "utf8")).id === id) unlinkSync(path);
      } catch {}
    }
  };
}
