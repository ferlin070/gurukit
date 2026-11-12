// JWT validation, trusted prompts, Pro authorization and atomic MYT quota reservations.
import { createClient } from "@supabase/supabase-js";
import { createGenerationHandler } from "../server/handler.js";
export const maxDuration = 60;
export default createGenerationHandler({ createClient });
