CREATE TABLE `puzzle_move_attempts` (
	`zobrist` text NOT NULL,
	`move` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`zobrist`, `move`),
	FOREIGN KEY (`zobrist`) REFERENCES `puzzle_stats`(`zobrist`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `puzzle_stats` DROP COLUMN `move_counts`;