// D1 profile schema. The first production migration is drizzle/0000_profiles.sql.
export interface ProfileRow {
  user_id: string;
  email: string;
  display_name: string;
  companies_json: string;
  experience: string;
  target_level: string;
  domains_json: string;
  skills: string;
  locations: string;
  titles: string;
  created_at: string;
  updated_at: string;
}

export const profilesSchema = {
  binding: "DB",
  table: "profiles",
  primaryKey: "user_id",
  columns: ["email", "display_name", "companies_json", "experience", "target_level", "domains_json", "skills", "locations", "titles", "created_at", "updated_at"],
} as const;
