import { useState, useEffect } from 'react';

import { supabase } from './supabase';

import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = false;

const listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;

  notify();
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => {
      forceRender((n) => n + 1);
    };

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  // Supabase signup failed
  if (error) {
    return {
      data,
      error,
    };
  }

  // With email confirmation disabled,
  // Supabase should return a session immediately.
  if (!data.user) {
    return {
      data,
      error: new Error(
        'Account was not created. Please check your Supabase Authentication settings.'
      ),
    };
  }

  // Save profile information if provided.
  if (profile) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: data.user.id,
          full_name: profile.full_name,
          email: email.trim(),
          role: profile.role,
        },
        {
          onConflict: 'id',
        }
      );

    if (profileError) {
      return {
        data,
        error: profileError,
      };
    }
  }

  // If Supabase returned a session, save it in the app.
  if (data.session) {
    setAuth(data.session);
  }

  return {
    data,
    error: null,
  };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (!error && data.session) {
    setAuth(data.session);
  }

  return {
    data,
    error,
  };
}

export async function signOut() {
  setAuth(null);

  const { error } = await supabase.auth.signOut();

  return {
    error,
  };
}