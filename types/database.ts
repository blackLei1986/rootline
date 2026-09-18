export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type UserOwnedRow = {
  user_id: string;
  created_at: string;
  updated_at: string;
};

type SharedRow = {
  id: string;
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDefinition<UserOwnedRow & {
        display_name: string | null;
        avatar_url: string | null;
        timezone: string;
        onboarding_status: "pending" | "active" | "complete";
      }>;
      user_preferences: TableDefinition<UserOwnedRow & {
        target_exams: string[];
        daily_time_budget: 10 | 20 | 30;
        preferred_topics: string[];
        difficulty_preference: "comfortable" | "balanced" | "challenging";
        recommendation_controls: Json;
      }>;
      word_learning_states: TableDefinition<UserOwnedRow & {
        id: string;
        word_id: string;
        state: Json;
        version: number;
        client_updated_at: string | null;
      }>;
      learner_auxiliary_state: TableDefinition<UserOwnedRow & {
        root_progress: Json;
        daily_stats: Json;
        calibration: Json | null;
        learning_settings: Json;
        transfer_stats: Json;
        storage_version: number;
        client_updated_at: string | null;
      }>;
      review_events: TableDefinition<Omit<UserOwnedRow, "updated_at"> & {
        id: string;
        client_event_id: string;
        event_type: string;
        word_id: string | null;
        session_id: string | null;
        occurred_at: string;
        payload: Json;
      }>;
      vocabulary_encounters: TableDefinition<UserOwnedRow & {
        id: string;
        word_id: string;
        document_kind: "reading-document" | "article";
        document_id: string;
        source_key: string | null;
        occurrence_count: number;
        first_encountered_at: string;
        last_encountered_at: string;
      }>;
      personal_sentences: TableDefinition<UserOwnedRow & {
        id: string;
        document_id: string | null;
        text: string;
        target_word_ids: string[];
      }>;
      today_plans: TableDefinition<UserOwnedRow & {
        id: string;
        learning_date: string;
        generation_version: number;
        status: "not-started" | "active" | "complete";
        estimated_minutes: number;
        selected_article_id: string | null;
        degradation_reason: string | null;
        plan_snapshot: Json;
        started_at: string | null;
        completed_at: string | null;
      }>;
      today_plan_items: TableDefinition<UserOwnedRow & {
        id: string;
        plan_id: string;
        item_type: "review" | "rapid-scan" | "focus-word" | "reading" | "context-question";
        position: number;
        content_id: string | null;
        payload: Json;
      }>;
      today_sessions: TableDefinition<UserOwnedRow & {
        id: string;
        plan_id: string;
        status: "active" | "complete";
        current_stage: string;
        actual_seconds: number;
        outcomes: Json;
        started_at: string;
        completed_at: string | null;
      }>;
      reading_documents: TableDefinition<UserOwnedRow & {
        id: string;
        title: string | null;
        source_type: string;
        document_text: string;
        analysis: Json;
        analysis_version: string;
        document_created_at: string;
      }>;
      reading_progress: TableDefinition<UserOwnedRow & {
        id: string;
        document_id: string;
        progress: Json;
        version: number;
        client_updated_at: string | null;
      }>;
      migration_batches: TableDefinition<UserOwnedRow & {
        id: string;
        source_installation_id: string;
        schema_version: number;
        status: "pending" | "running" | "partial" | "complete" | "failed";
        attempt_count: number;
        entity_counts: Json;
        verified_at: string | null;
      }>;
      migration_items: TableDefinition<UserOwnedRow & {
        id: string;
        batch_id: string;
        entity_type: string;
        legacy_id: string;
        content_hash: string;
        result: "imported" | "skipped" | "failed";
        error_category: string | null;
      }>;
      sync_operations: TableDefinition<UserOwnedRow & {
        id: string;
        operation_id: string;
        operation_kind:
          | "word-state"
          | "learning-event"
          | "learner-auxiliary"
          | "reading-document"
          | "reading-progress"
          | "personal-sentence"
          | "today-plan"
          | "today-event"
          | "reading-encounter";
        entity_id: string;
        entity_version: number;
        applied_at: string;
      }>;
      feed_sources: TableDefinition<SharedRow & {
        normalized_feed_url: string;
        site_url: string | null;
        title: string;
        description: string | null;
        etag: string | null;
        last_modified: string | null;
        fetch_status: "idle" | "fetching" | "ready" | "failed";
        last_successful_fetch_at: string | null;
        next_retry_at: string | null;
        last_error_code: string | null;
      }>;
      user_feed_subscriptions: TableDefinition<UserOwnedRow & {
        id: string;
        feed_source_id: string;
        enabled: boolean;
        topic_tags: string[];
        preference_weight: number;
      }>;
      articles: TableDefinition<SharedRow & {
        feed_source_id: string | null;
        external_id: string | null;
        canonical_url: string;
        publisher_url: string;
        title: string;
        author: string | null;
        published_at: string | null;
        summary: string | null;
        language: string;
        extracted_text: string | null;
        content_fingerprint: string | null;
        extraction_status: "pending" | "extracted" | "rejected" | "failed";
        extraction_error_code: string | null;
        analysis_version: string | null;
      }>;
      article_analyses: TableDefinition<{
        article_id: string;
        vocabulary_version: string;
        analysis_state: "metadata" | "full" | "stale";
        word_count: number;
        unique_lemma_count: number;
        estimated_minutes: number;
        lexical_matches: Json;
        topic_features: Json;
        analyzed_at: string;
        created_at: string;
        updated_at: string;
      }>;
      user_article_scores: TableDefinition<UserOwnedRow & {
        id: string;
        article_id: string;
        content_word_coverage: number;
        valuable_unknown_word_ids: string[];
        score: number;
        explanation_codes: string[];
        score_version: number;
        scored_at: string;
      }>;
      user_article_states: TableDefinition<UserOwnedRow & {
        id: string;
        article_id: string;
        saved: boolean;
        hidden: boolean;
        opened_at: string | null;
        completed_at: string | null;
        progress: Json;
        feedback: "too-easy" | "good-fit" | "too-hard" | "not-interested" | null;
        last_interaction_at: string | null;
      }>;
      feed_fetch_runs: TableDefinition<SharedRow & {
        feed_source_id: string;
        status: "running" | "updated" | "not-modified" | "failed";
        fetched_count: number;
        inserted_count: number;
        duplicate_count: number;
        error_code: string | null;
        started_at: string;
        completed_at: string | null;
      }>;
    };
    Views: {
      article_catalog: {
        Row: {
          id: string;
          feed_source_id: string | null;
          canonical_url: string;
          publisher_url: string;
          title: string;
          author: string | null;
          published_at: string | null;
          summary: string | null;
          language: string;
          extraction_status: "pending" | "extracted" | "rejected" | "failed";
          word_count: number | null;
          estimated_minutes: number | null;
          vocabulary_version: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_today_plan: {
        Args: {
          p_user_id: string;
          p_plan_id: string;
          p_learning_date: string;
          p_version: number;
          p_status: string;
          p_estimated_minutes: number;
          p_selected_article_id: string | null;
          p_degradation_reason: string | null;
          p_plan_snapshot: Json;
          p_items: Json;
        };
        Returns: Json;
      };
      record_today_event: {
        Args: {
          p_user_id: string;
          p_operation_id: string;
          p_plan_id: string;
          p_event: Json;
          p_session: Json;
        };
        Returns: Json;
      };
      record_article_encounter: {
        Args: {
          p_user_id: string;
          p_operation_id: string;
          p_word_id: string;
          p_article_id: string;
          p_source_key: string;
          p_occurrence_count: number;
          p_first_encountered_at: string;
          p_last_encountered_at: string;
        };
        Returns: boolean;
      };
      apply_sync_operation: {
        Args: {
          p_user_id: string;
          p_operation_id: string;
          p_kind: string;
          p_entity_id: string;
          p_version: number;
          p_payload: Json;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

interface TableDefinition<
  Row extends Record<string, unknown>,
  RequiredInsert extends keyof Row = Extract<"user_id", keyof Row>
> {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, RequiredInsert>;
  Update: Partial<Row>;
  Relationships: [];
}
