CREATE TABLE `counter` (
	`id` integer PRIMARY KEY NOT NULL,
	`value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_puzzles` (
	`date` text PRIMARY KEY NOT NULL,
	`zobrist` text NOT NULL,
	FOREIGN KEY (`zobrist`) REFERENCES `puzzle_stats`(`zobrist`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	PRIMARY KEY(`provider`, `provider_user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `puzzle_move_attempts` (
	`zobrist` text NOT NULL,
	`move` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`zobrist`, `move`),
	FOREIGN KEY (`zobrist`) REFERENCES `puzzle_stats`(`zobrist`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `puzzle_stats` (
	`zobrist` text PRIMARY KEY NOT NULL,
	`visitor_count` integer DEFAULT 0 NOT NULL,
	`solve_count` integer DEFAULT 0 NOT NULL,
	`total_moves_found` integer DEFAULT 0 NOT NULL,
	`total_target_moves` integer DEFAULT 0 NOT NULL,
	`total_strikes_used` integer DEFAULT 0 NOT NULL,
	`total_time_ms` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `site_visits` (
	`date` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_solves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
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
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`participation_streak` integer DEFAULT 0 NOT NULL,
	`win_streak` integer DEFAULT 0 NOT NULL,
	`last_daily_date` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);