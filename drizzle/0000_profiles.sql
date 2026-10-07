CREATE TABLE `profiles` (
  `user_id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `display_name` text NOT NULL,
  `companies_json` text DEFAULT '[]' NOT NULL,
  `experience` text DEFAULT '' NOT NULL,
  `target_level` text DEFAULT '' NOT NULL,
  `domains_json` text DEFAULT '[]' NOT NULL,
  `skills` text DEFAULT '' NOT NULL,
  `locations` text DEFAULT '' NOT NULL,
  `titles` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_profiles_email` ON `profiles` (`email`);
