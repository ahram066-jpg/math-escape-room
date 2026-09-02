ALTER TABLE `escape_results` ADD `score` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `escape_results` ADD `hint_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `escape_results` ADD `hints_json` text DEFAULT '{}' NOT NULL;