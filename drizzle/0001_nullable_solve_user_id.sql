-- Recreate user_solves with nullable user_id so we can anonymise solves on account deletion
CREATE TABLE `user_solves_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`zobrist` text,
	`strikes_allowed` integer NOT NULL,
	`strikes_used` integer NOT NULL,
	`moves_found` integer NOT NULL,
	`target_moves` integer NOT NULL,
	`guesses` text NOT NULL,
	`hidden_gems` text,
	`time_ms` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`zobrist`) REFERENCES `puzzle_stats`(`zobrist`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `user_solves_new` SELECT * FROM `user_solves`;
--> statement-breakpoint
DROP TABLE `user_solves`;
--> statement-breakpoint
ALTER TABLE `user_solves_new` RENAME TO `user_solves`;
