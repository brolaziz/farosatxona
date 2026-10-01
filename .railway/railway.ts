import {
  defineRailway,
  github,
  preserve,
  project,
  service,
  volume,
} from "railway/iac";

// This repository owns only its bot service and data volume. Other services
// in the user's existing Railway project belong to their own repositories.
export const partial = "farosatxona";

export default defineRailway((context) => {
  const data = volume("farosat-data", { sizeMB: 500 });
  const app = service("farosatxona", {
    source: github("brolaziz/farosatxona", { branch: "main" }),
    // Railway discovers Dockerfile automatically. Its public Builder enum
    // accepts RAILPACK; DOCKERFILE is not accepted by this API version.
    build: { builder: "RAILPACK", dockerfilePath: "Dockerfile" },
    deploy: {
      startCommand: "node src/index.js",
      numReplicas: 1,
      healthcheckPath: "/health",
      healthcheckTimeout: 120,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
      sleepApplication: false,
      requiredMountPath: "/app/data",
      overlapSeconds: 0,
      drainingSeconds: 30,
    },
    volumeMounts: { "/app/data": data },
    variables: {
      NODE_ENV: "production",
      HOST: "0.0.0.0",
      PORT: "3000",
      TZ: "Asia/Tashkent",
      DATABASE_PATH: "/app/data/farosatxona.db",
      BACKUP_DIR: "/app/data/backups",
      AUTO_BACKUP: "true",
      RAILWAY_RUN_UID: "0",
      BOT_TOKEN: preserve(),
      ADMIN_IDS: preserve(),
      WEB_APP_URL: "https://farosatxona-production.up.railway.app",
      SUPPORT_URL: "https://t.me/coderceo",
      BOT_USERNAME: "farosatxonabot",
    },
  });

  return project(context.projectName || "farosatxona", {
    resources: [data, app],
  });
});
