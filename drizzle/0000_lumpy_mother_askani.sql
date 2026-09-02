CREATE TABLE `escape_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`class_name` text NOT NULL,
	`student_number` text NOT NULL,
	`student_name` text NOT NULL,
	`elapsed_seconds` integer NOT NULL,
	`remaining_seconds` integer NOT NULL,
	`attempts_json` text DEFAULT '{}' NOT NULL,
	`reflection` text DEFAULT '' NOT NULL,
	`rating` integer NOT NULL,
	`started_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
