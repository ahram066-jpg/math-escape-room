ALTER TABLE `escape_results` ADD `run_id` text;--> statement-breakpoint
ALTER TABLE `escape_results` ADD `time_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `escape_results` ADD `wrong_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `escape_results` ADD `wrong_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `escape_results` ADD `bonus_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `escape_results` ADD `bonus_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `escape_results` ADD `final_score` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `escape_results` ADD `rank` text DEFAULT 'D — 탈출 성공!' NOT NULL;--> statement-breakpoint
ALTER TABLE `escape_results` ADD `completed_at` text;