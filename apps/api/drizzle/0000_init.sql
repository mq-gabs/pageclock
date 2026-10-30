CREATE TABLE `auth_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_tokens_user_id_idx` ON `auth_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`total_pages` integer NOT NULL,
	`status` text DEFAULT 'want_to_read' NOT NULL,
	`finished_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "books_title_length" CHECK(length("books"."title") between 1 and 300),
	CONSTRAINT "books_author_length" CHECK(length("books"."author") between 1 and 200),
	CONSTRAINT "books_total_pages_range" CHECK("books"."total_pages" between 1 and 10000),
	CONSTRAINT "books_status_enum" CHECK("books"."status" in ('want_to_read', 'reading', 'finished'))
);
--> statement-breakpoint
CREATE INDEX `books_user_id_updated_at_idx` ON `books` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`paused_at` integer,
	`paused_seconds` integer DEFAULT 0 NOT NULL,
	`start_page` integer NOT NULL,
	`end_page` integer,
	`source` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reading_sessions_start_page_min" CHECK("reading_sessions"."start_page" >= 1),
	CONSTRAINT "reading_sessions_paused_seconds_min" CHECK("reading_sessions"."paused_seconds" >= 0),
	CONSTRAINT "reading_sessions_source_enum" CHECK("reading_sessions"."source" in ('timer', 'manual'))
);
--> statement-breakpoint
CREATE INDEX `reading_sessions_user_id_started_at_idx` ON `reading_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `reading_sessions_book_id_started_at_idx` ON `reading_sessions` (`book_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`nick` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "users_name_length" CHECK(length("users"."name") between 1 and 100),
	CONSTRAINT "users_nick_length" CHECK(length("users"."nick") between 3 and 30)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_nick_unique` ON `users` (`nick`);