// src/data/creators.ts
import { supabase } from '../lib/supabase';

export async function getCreator(wallet: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('wallet', wallet)
    .maybeSingle();
  if (error) throw error;
  return data; // { wallet, created_at, ...optional fields }
}
