// 恐龍待機遊戲已自產品移除（2026-07-31），清掉對應資料表。
// 舊的 20260705000006_create_dino.js 保留在目錄中，讓已跑過該 migration 的資料庫
// （如 Neon 上的正式庫）通過 knex 的完整性檢查。
exports.up = async function (knex) {
  await knex.schema.dropTableIfExists('dino_scores')
  await knex.schema.dropTableIfExists('dino_rounds')
}

exports.down = async function (knex) {
  // 不還原：功能已移除，rollback 時不重建資料表。
}
