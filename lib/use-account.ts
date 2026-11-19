'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from './supabase';
import { isMissingAccountSchema, normaliseAccountType } from './account-type';
import type { AccountType } from './account-type';

export const ACCOUNT_CHANGED_EVENT = 'cartomux-account-changed';

export type MyAccount = {
  loading: boolean;
  signedIn: boolean;
  userId: string;
  /** null until known, or when the database update has not been applied yet (nothing is locked then). */
  accountType: AccountType | null;
  businessName: string;
  businessCategory: string;
  isVendor: boolean;
  isStudent: boolean;
  refresh: () => Promise<void>;
};

/** The signed-in user's account type. Re-reads automatically after a switch in Settings. */
export function useMyAccount(): MyAccount {
  const [state, setState] = useState({ loading: true, signedIn: false, userId: '', accountType: null as AccountType | null, businessName: '', businessCategory: '' });

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setState({ loading: false, signedIn: false, userId: '', accountType: null, businessName: '', businessCategory: '' }); return; }
    const { data, error } = await supabase.from('profiles').select('account_type,business_name,business_category').eq('id', user.id).maybeSingle();
    if (error) {
      if (!isMissingAccountSchema(error)) console.warn('CARTOMUX: could not read the account type', error.message);
      setState({ loading: false, signedIn: true, userId: user.id, accountType: null, businessName: '', businessCategory: '' });
      return;
    }
    setState({ loading: false, signedIn: true, userId: user.id, accountType: normaliseAccountType(data?.account_type), businessName: data?.business_name || '', businessCategory: data?.business_category || '' });
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => { refresh(); };
    window.addEventListener(ACCOUNT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ACCOUNT_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { ...state, isVendor: state.accountType === 'vendor', isStudent: state.accountType === 'student', refresh };
}
