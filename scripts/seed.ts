/** 本地执行：npm run seed [-- --reset]（DATABASE_URL 指向目标库；本地环境需能访问 Google News） */
import { runSeed } from "../src/lib/seed";

runSeed(process.argv.includes("--reset")).catch((e) => {
  console.error("种子失败：", e);
  process.exit(1);
});
