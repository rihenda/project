import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://oqqydrbinqdqqvqbfmrv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcXlkcmJpbnFkcXF2cWJmbXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjExNzUsImV4cCI6MjA5MTczNzE3NX0.zLNggRnCtvHN7mPrI726ZEDnKLtv-y-YqCMdsVzWWGE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
