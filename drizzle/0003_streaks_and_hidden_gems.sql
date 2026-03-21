ALTER TABLE `users` ADD `participation_streak` integer NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD `win_streak` integer NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD `last_daily_date` text;
ALTER TABLE `user_solves` ADD `hidden_gems` text;
ALTER TABLE `user_solves` RENAME COLUMN `total_moves` TO `target_moves`;
ALTER TABLE `puzzle_stats` RENAME COLUMN `total_possible_moves` TO `total_target_moves`;
