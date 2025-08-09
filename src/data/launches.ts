// src/data/launches.ts
import { supabase } from '../lib/supabase';
import type { WizardData } from '../types/wizard';

type LaunchStatus = 'draft' | 'created' | 'upcoming' | 'active' | 'ended' | 'failed' | 'finalized';

async function ensureCreator(wallet: string) {
  // Insert on first save; ignore duplicates on later saves (no UPDATE needed)
  const { error } = await supabase
    .from('creators')
    .upsert({ wallet }, { onConflict: 'wallet', ignoreDuplicates: true });
  if (error) throw error;
}

async function findDraftIdForWallet(wallet: string): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('launches')
    .select('id')
    .eq('creator_wallet', wallet)
    .eq('status', 'draft')
    .limit(1)
    .maybeSingle();

  // PGRST116 = no rows; ignore it
  if (error && (error as any).code !== 'PGRST116') throw error;
  return data?.id;
}

/**
 * Insert or update a launch.
 *
 * - If `status === 'draft'` and no id is provided, it reuses the existing draft for this wallet if present.
 * - If `status !== 'draft'` and no id is provided, it **promotes** the existing draft to that status if present.
 * - If `id` is provided, it updates that row.
 */
export async function upsertLaunch(
  wallet: string,
  data: WizardData,
  id?: string,
  status: LaunchStatus = 'draft'
) {
  await ensureCreator(wallet);

  // Decide which row we're targeting
  let targetId = id;

  if (!targetId) {
    const existingDraftId = await findDraftIdForWallet(wallet);

    if (status === 'draft') {
      // Save/Update draft → reuse draft id if exists
      if (existingDraftId) targetId = existingDraftId;
    } else {
      // Creating/publishing → promote draft if exists, otherwise insert new
      if (existingDraftId) targetId = existingDraftId;
    }
  }

  const row = {
    ...(targetId ? { id: targetId } : {}),
    creator_wallet: wallet,
    chain: 'apechain',
    dex: 'camelot',

    // project
    name: data.project.name,
    description: data.project.description,
    website: data.project.website,
    twitter: data.project.twitter,
    logo_url: data.project.logoUrl,

    // token
    token_name: data.token.name,
    token_symbol: data.token.symbol,
    token_decimals: data.token.decimals,
    token_total_supply: data.token.totalSupply ?? null,

    // sale (fair by default)
    kind: 'fair',
    quote: data.sale?.quote ?? 'WAPE',
    start_at: data.sale?.start ? new Date(data.sale.start).toISOString() : null,
    end_at:   data.sale?.end ? new Date(data.sale.end).toISOString()   : null,
    soft_cap: data.sale?.softCap ?? null,
    hard_cap: data.sale?.hardCap ?? null,
    keep_pct: data.sale?.keepPct ?? 0,
    sale_tokens_pool: data.sale?.saleTokensPool ?? null,
    min_per_wallet: data.sale?.minPerWallet ?? null,
    max_per_wallet: data.sale?.maxPerWallet ?? null,

    // allowlist
    allowlist_enabled: !!data.allowlist?.enabled,
    allowlist_root: data.allowlist?.root ?? null,
    allowlist_count: data.allowlist?.count ?? null,

    // lp & fees
    lp_percent: data.lp?.percentToLP ?? 60,
    lp_lock_days: data.lp?.lockDays ?? 90,
    raise_fee_pct: data.fees?.raisePct ?? 5,
    supply_fee_pct: data.fees?.supplyPct ?? 0.05,

    status,
    updated_at: new Date().toISOString(),
  };

  if (targetId) {
    // UPDATE
    const { data: updated, error } = await supabase
      .from('launches')
      .update(row)
      .eq('id', targetId)
      .select()
      .single();
    if (error) throw error;
    return updated;
  } else {
    // INSERT
    const { data: inserted, error } = await supabase
      .from('launches')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return inserted;
  }
}

/** Simple explore list (optional helpers, handy for the Explore page) */
export async function listExplore() {
  const { data, error } = await supabase
    .from('launches')
    .select('id, name, token_symbol, status, start_at, end_at, soft_cap, hard_cap')
    .neq('status', 'draft')                 // ⬅️ exclude drafts
    .order('start_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}


export async function getLaunch(id: string) {
  const { data, error } = await supabase
    .from('launches')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
export async function listByCreator(wallet: string) {
  const { data, error } = await supabase
    .from('launches')
    .select('id, name, token_symbol, status, start_at, end_at, soft_cap, hard_cap, updated_at')
    .eq('creator_wallet', wallet)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
