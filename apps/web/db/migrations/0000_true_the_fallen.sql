CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`url` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `assets_project_idx` ON `assets` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_r2_key_uidx` ON `assets` (`r2_key`);--> statement-breakpoint
CREATE TABLE `branch_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`source_branch_id` text NOT NULL,
	`page_hashes` text NOT NULL,
	`folder_paths` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `branch_snapshots_branch_idx` ON `branch_snapshots` (`branch_id`);--> statement-breakpoint
CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer NOT NULL,
	`is_locked` integer NOT NULL,
	`source_branch_id` text,
	`deleted_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `branches_project_idx` ON `branches` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `branches_project_name_uidx` ON `branches` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `comment_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`block_id` text NOT NULL,
	`anchor_type` text NOT NULL,
	`inline_start` integer,
	`inline_end` integer,
	`quoted_text` text,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comment_threads_page_idx` ON `comment_threads` (`page_id`);--> statement-breakpoint
CREATE INDEX `comment_threads_page_status_idx` ON `comment_threads` (`page_id`,`status`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`content` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_edited` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `comment_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comments_thread_idx` ON `comments` (`thread_id`);--> statement-breakpoint
CREATE TABLE `deployment_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`cf_project_name` text,
	`vercel_project_id` text,
	`vercel_team_id` text,
	`vercel_token` text,
	`branch_id` text,
	`live_deployment_id` text,
	`access_app_id` text,
	`production_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`live_deployment_id`) REFERENCES `deployments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_configs_project_uidx` ON `deployment_configs` (`project_id`);--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`external_deployment_id` text,
	`cf_project_name` text,
	`vercel_deployment_id` text,
	`url` text,
	`status` text NOT NULL,
	`target` text NOT NULL,
	`error` text,
	`content_hashes` text,
	`build_phase` text,
	`warnings` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `deployments_project_idx` ON `deployments` (`project_id`);--> statement-breakpoint
CREATE INDEX `deployments_project_created_at_idx` ON `deployments` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `deployments_branch_idx` ON `deployments` (`branch_id`);--> statement-breakpoint
CREATE INDEX `deployments_vercel_id_idx` ON `deployments` (`vercel_deployment_id`);--> statement-breakpoint
CREATE INDEX `deployments_external_id_idx` ON `deployments` (`external_deployment_id`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`position` integer NOT NULL,
	`path` text NOT NULL,
	`icon` text,
	`ai_generation_job_id` text,
	`ai_pending_review` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `folders_branch_idx` ON `folders` (`branch_id`);--> statement-breakpoint
CREATE INDEX `folders_parent_idx` ON `folders` (`parent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `folders_branch_path_uidx` ON `folders` (`branch_id`,`path`);--> statement-breakpoint
CREATE INDEX `folders_generation_job_idx` ON `folders` (`ai_generation_job_id`);--> statement-breakpoint
CREATE TABLE `legacy_id_map` (
	`source_table` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`imported_at` integer NOT NULL,
	PRIMARY KEY(`source_table`, `source_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legacy_id_map_target_uidx` ON `legacy_id_map` (`source_table`,`target_id`);--> statement-breakpoint
CREATE TABLE `merge_request_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`merge_request_id` text NOT NULL,
	`page_path` text,
	`block_index` integer,
	`content` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`merge_request_id`) REFERENCES `merge_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `merge_request_comments_request_idx` ON `merge_request_comments` (`merge_request_id`);--> statement-breakpoint
CREATE TABLE `merge_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_branch_id` text NOT NULL,
	`target_branch_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`diff_summary` text,
	`diff_snapshot` text,
	`resolutions` text,
	`github_pr_number` integer,
	`github_pr_url` text,
	`github_repo_full_name` text,
	`review_status` text,
	`created_by` text NOT NULL,
	`merged_by` text,
	`merged_at` integer,
	`closed_by` text,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`merged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `merge_requests_project_idx` ON `merge_requests` (`project_id`);--> statement-breakpoint
CREATE INDEX `merge_requests_project_status_idx` ON `merge_requests` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `merge_requests_source_branch_idx` ON `merge_requests` (`source_branch_id`);--> statement-breakpoint
CREATE INDEX `merge_requests_target_branch_idx` ON `merge_requests` (`target_branch_id`);--> statement-breakpoint
CREATE INDEX `merge_requests_github_pr_idx` ON `merge_requests` (`github_repo_full_name`,`github_pr_number`);--> statement-breakpoint
CREATE TABLE `mr_review_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`content` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_edited` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `mr_review_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mr_review_comments_thread_idx` ON `mr_review_comments` (`thread_id`);--> statement-breakpoint
CREATE TABLE `mr_review_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`merge_request_id` text NOT NULL,
	`page_path` text NOT NULL,
	`block_id` text NOT NULL,
	`block_index` integer NOT NULL,
	`quoted_content` text,
	`thread_type` text NOT NULL,
	`suggested_content` text,
	`suggestion_status` text,
	`status` text NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`merge_request_id`) REFERENCES `merge_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mr_review_threads_request_idx` ON `mr_review_threads` (`merge_request_id`);--> statement-breakpoint
CREATE INDEX `mr_review_threads_request_page_idx` ON `mr_review_threads` (`merge_request_id`,`page_path`);--> statement-breakpoint
CREATE TABLE `mr_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`merge_request_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`status` text NOT NULL,
	`body` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`merge_request_id`) REFERENCES `merge_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mr_reviews_request_idx` ON `mr_reviews` (`merge_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mr_reviews_request_reviewer_uidx` ON `mr_reviews` (`merge_request_id`,`reviewer_id`);--> statement-breakpoint
CREATE TABLE `page_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`content` text NOT NULL,
	`mdx_cache` text,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_contents_page_uidx` ON `page_contents` (`page_id`);--> statement-breakpoint
CREATE TABLE `page_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`page_slug` text NOT NULL,
	`reaction` text NOT NULL,
	`session_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `page_feedback_project_page_idx` ON `page_feedback` (`project_id`,`page_slug`);--> statement-breakpoint
CREATE INDEX `page_feedback_session_page_idx` ON `page_feedback` (`session_id`,`page_slug`);--> statement-breakpoint
CREATE TABLE `page_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`version` integer NOT NULL,
	`content` text NOT NULL,
	`content_hash` text,
	`created_by` text,
	`message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `page_versions_page_idx` ON `page_versions` (`page_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `page_versions_page_version_uidx` ON `page_versions` (`page_id`,`version`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`folder_id` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`path` text NOT NULL,
	`position` integer NOT NULL,
	`is_published` integer NOT NULL,
	`description` text,
	`icon` text,
	`subtitle` text,
	`title_section_hidden` integer,
	`title_icon_hidden` integer,
	`ai_generated` integer,
	`ai_generation_job_id` text,
	`ai_pending_review` integer,
	`ai_folder_slug` text,
	`seo_title` text,
	`seo_description` text,
	`og_image_asset_id` text,
	`noindex` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pages_branch_idx` ON `pages` (`branch_id`);--> statement-breakpoint
CREATE INDEX `pages_folder_idx` ON `pages` (`folder_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_branch_path_uidx` ON `pages` (`branch_id`,`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_branch_folder_slug_uidx` ON `pages` (`branch_id`,`folder_id`,`slug`);--> statement-breakpoint
CREATE INDEX `pages_branch_updated_at_idx` ON `pages` (`branch_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `pages_generation_job_idx` ON `pages` (`ai_generation_job_id`);--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`added_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_members_project_idx` ON `project_members` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_members_user_idx` ON `project_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_members_project_user_uidx` ON `project_members` (`project_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`legacy_org_id` text,
	`workos_org_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`is_public` integer NOT NULL,
	`default_branch_id` text,
	`settings` text,
	`plan` text,
	`had_trial` integer,
	`trial_ends_at` integer,
	`had_retention_offer` integer,
	`stripe_trial_subscription_id` text,
	`cf_slug` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_legacy_org_idx` ON `projects` (`legacy_org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_legacy_org_slug_uidx` ON `projects` (`legacy_org_id`,`slug`);--> statement-breakpoint
CREATE INDEX `projects_workos_org_idx` ON `projects` (`workos_org_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_workos_org_slug_uidx` ON `projects` (`workos_org_id`,`slug`);--> statement-breakpoint
CREATE INDEX `projects_workos_org_updated_at_idx` ON `projects` (`workos_org_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `projects_cf_slug_idx` ON `projects` (`cf_slug`);--> statement-breakpoint
CREATE INDEX `projects_created_by_idx` ON `projects` (`created_by`);--> statement-breakpoint
CREATE INDEX `projects_updated_at_idx` ON `projects` (`updated_at`);--> statement-breakpoint
CREATE TABLE `search_index` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`headings` text NOT NULL,
	`content` text NOT NULL,
	`code_blocks` text NOT NULL,
	`path` text NOT NULL,
	`excerpt` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `search_index_project_idx` ON `search_index` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `search_index_page_uidx` ON `search_index` (`page_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`workos_user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`auth_provider` text NOT NULL,
	`onboarding_completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_workos_user_id_uidx` ON `users` (`workos_user_id`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE VIRTUAL TABLE `search_fts` USING fts5(
	`title`,
	`headings`,
	`content`,
	`code_blocks`,
	`project_id` UNINDEXED,
	`page_id` UNINDEXED,
	`path` UNINDEXED,
	`excerpt` UNINDEXED,
	content='search_index',
	content_rowid='rowid',
	tokenize='unicode61'
);--> statement-breakpoint
CREATE TRIGGER `search_index_after_insert` AFTER INSERT ON `search_index` BEGIN
	INSERT INTO `search_fts`(
		rowid,
		title,
		headings,
		content,
		code_blocks,
		project_id,
		page_id,
		path,
		excerpt
	) VALUES (
		new.rowid,
		new.title,
		new.headings,
		new.content,
		new.code_blocks,
		new.project_id,
		new.page_id,
		new.path,
		new.excerpt
	);
END;--> statement-breakpoint
CREATE TRIGGER `search_index_after_delete` AFTER DELETE ON `search_index` BEGIN
	INSERT INTO `search_fts`(
		`search_fts`,
		rowid,
		title,
		headings,
		content,
		code_blocks,
		project_id,
		page_id,
		path,
		excerpt
	) VALUES (
		'delete',
		old.rowid,
		old.title,
		old.headings,
		old.content,
		old.code_blocks,
		old.project_id,
		old.page_id,
		old.path,
		old.excerpt
	);
END;--> statement-breakpoint
CREATE TRIGGER `search_index_after_update` AFTER UPDATE ON `search_index` BEGIN
	INSERT INTO `search_fts`(
		`search_fts`,
		rowid,
		title,
		headings,
		content,
		code_blocks,
		project_id,
		page_id,
		path,
		excerpt
	) VALUES (
		'delete',
		old.rowid,
		old.title,
		old.headings,
		old.content,
		old.code_blocks,
		old.project_id,
		old.page_id,
		old.path,
		old.excerpt
	);
	INSERT INTO `search_fts`(
		rowid,
		title,
		headings,
		content,
		code_blocks,
		project_id,
		page_id,
		path,
		excerpt
	) VALUES (
		new.rowid,
		new.title,
		new.headings,
		new.content,
		new.code_blocks,
		new.project_id,
		new.page_id,
		new.path,
		new.excerpt
	);
END;
